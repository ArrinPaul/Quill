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
});
