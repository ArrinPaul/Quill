const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers/testApp");

describe("Tasks ownership and validation", () => {
  let ctx;
  let userA;
  let userB;
  let taskA;

  before(async () => {
    ctx = await startTestServer();
    userA = await ctx.registerStudent();
    userB = await ctx.registerStudent();
  });

  after(async () => {
    await ctx.close();
  });

  it("rejects unauthenticated requests", async () => {
    const res = await ctx.request("GET", "/api/tasks");
    assert.equal(res.status, 401);
  });

  it("validates required task fields", async () => {
    const res = await ctx.request("POST", "/api/tasks", {
      token: userA.token,
      body: { title: "   ", subject: "CS101", deadline: new Date().toISOString() },
    });
    assert.equal(res.status, 400);
  });

  it("creates a task for user A and hides it from user B", async () => {
    const deadline = new Date(Date.now() + 3600_000).toISOString();
    const createRes = await ctx.request("POST", "/api/tasks", {
      token: userA.token,
      body: { title: "Lab 1", subject: "CS101", deadline },
    });
    assert.equal(createRes.status, 200);
    taskA = createRes.data.task;
    assert.equal(taskA.title, "Lab 1");

    const listA = await ctx.request("GET", "/api/tasks", { token: userA.token });
    assert.equal(listA.status, 200);
    assert.equal(listA.data.tasks.length, 1);

    const listB = await ctx.request("GET", "/api/tasks", { token: userB.token });
    assert.equal(listB.status, 200);
    assert.equal(listB.data.tasks.length, 0);
  });

  it("prevents user B from updating or deleting user A's task", async () => {
    const putB = await ctx.request("PUT", `/api/tasks/${taskA.id}`, {
      token: userB.token,
      body: { title: "Hacked", subject: "CS101" },
    });
    assert.ok(putB.status >= 400);

    await ctx.request("DELETE", `/api/tasks/${taskA.id}`, { token: userB.token });

    const listA = await ctx.request("GET", "/api/tasks", { token: userA.token });
    assert.equal(listA.data.tasks.length, 1);
    assert.equal(listA.data.tasks[0].title, "Lab 1");
  });

  it("validates and stores task importance on POST and PUT", async () => {
    const deadline = new Date(Date.now() + 7200_000).toISOString();

    const invalidCreate = await ctx.request("POST", "/api/tasks", {
      token: userA.token,
      body: { title: "Bad importance", subject: "CS101", deadline, importance: "urgent" },
    });
    assert.equal(invalidCreate.status, 400);

    const createHigh = await ctx.request("POST", "/api/tasks", {
      token: userA.token,
      body: { title: "Exam Prep", subject: "CS101", deadline, importance: "high" },
    });
    assert.equal(createHigh.status, 200);
    assert.equal(createHigh.data.task.importance, "high");

    const invalidUpdate = await ctx.request("PUT", `/api/tasks/${createHigh.data.task.id}`, {
      token: userA.token,
      body: { importance: "critical" },
    });
    assert.equal(invalidUpdate.status, 400);

    const updateLow = await ctx.request("PUT", `/api/tasks/${createHigh.data.task.id}`, {
      token: userA.token,
      body: { importance: "low" },
    });
    assert.equal(updateLow.status, 200);
    assert.equal(updateLow.data.task.importance, "low");
  });

  it("supports in_progress status on POST and PUT", async () => {
    const deadline = new Date(Date.now() + 10800_000).toISOString();
    const createRes = await ctx.request("POST", "/api/tasks", {
      token: userA.token,
      body: { title: "Draft Essay", subject: "ENG101", deadline, status: "in_progress" },
    });
    assert.equal(createRes.status, 200);
    assert.equal(createRes.data.task.status, "in_progress");

    const updateRes = await ctx.request("PUT", `/api/tasks/${taskA.id}`, {
      token: userA.token,
      body: { status: "in_progress" },
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.data.task.status, "in_progress");
  });

  it("creates a +7d copy on completing a weekly task and never duplicates on un-complete + re-complete", async () => {
    const deadline = "2026-12-01T10:00:00.000Z";
    const reminder = "2026-11-30T10:00:00.000Z";

    const createRes = await ctx.request("POST", "/api/tasks", {
      token: userA.token,
      body: {
        title: "Weekly Quiz",
        subject: "MATH101",
        deadline,
        reminder_time: reminder,
        repeat: "weekly",
      },
    });
    assert.equal(createRes.status, 200);
    const weeklyTask = createRes.data.task;
    assert.equal(weeklyTask.repeat, "weekly");

    const completeRes = await ctx.request("PUT", `/api/tasks/${weeklyTask.id}`, {
      token: userA.token,
      body: { status: "completed" },
    });
    assert.equal(completeRes.status, 200);
    assert.equal(completeRes.data.task.status, "completed");
    assert.ok(completeRes.data.nextTask);
    assert.equal(completeRes.data.nextTask.status, "pending");
    assert.equal(completeRes.data.nextTask.repeat, "weekly");
    assert.equal(completeRes.data.nextTask.repeat_parent, weeklyTask.id);
    assert.equal(completeRes.data.nextTask.deadline, "2026-12-08T10:00:00.000Z");
    assert.equal(completeRes.data.nextTask.reminder_time, "2026-12-07T10:00:00.000Z");

    const beforeList = await ctx.request("GET", "/api/tasks", { token: userA.token });
    const countBefore = beforeList.data.tasks.length;

    const uncompleteRes = await ctx.request("PUT", `/api/tasks/${weeklyTask.id}`, {
      token: userA.token,
      body: { status: "pending" },
    });
    assert.equal(uncompleteRes.status, 200);
    assert.equal(uncompleteRes.data.task.status, "pending");

    const recompleteRes = await ctx.request("PUT", `/api/tasks/${weeklyTask.id}`, {
      token: userA.token,
      body: { status: "completed" },
    });
    assert.equal(recompleteRes.status, 200);
    assert.equal(recompleteRes.data.task.status, "completed");
    assert.equal(recompleteRes.data.nextTask, undefined);

    const afterList = await ctx.request("GET", "/api/tasks", { token: userA.token });
    assert.equal(afterList.data.tasks.length, countBefore);
  });
});
