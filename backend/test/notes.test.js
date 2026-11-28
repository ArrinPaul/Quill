const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers/testApp");
const { setCompleter } = require("../src/services/groq");

describe("P3 Notes API", () => {
  let ctx;
  let userA;
  let userB;
  let prevDailyLimit;

  before(async () => {
    prevDailyLimit = process.env.AI_DAILY_LIMIT;
    ctx = await startTestServer();
    userA = await ctx.registerStudent();
    userB = await ctx.registerStudent();
  });

  afterEach(() => {
    setCompleter(null);
    if (prevDailyLimit === undefined) {
      delete process.env.AI_DAILY_LIMIT;
    } else {
      process.env.AI_DAILY_LIMIT = prevDailyLimit;
    }
  });

  after(async () => {
    await ctx.close();
  });

  it("rejects unauthenticated requests with 401", async () => {
    const fakeId = "00000000-0000-4000-8000-000000000001";
    for (const [method, path, body] of [
      ["GET", "/api/notes"],
      ["POST", "/api/notes", { title: "Hi" }],
      ["GET", `/api/notes/${fakeId}`],
      ["PUT", `/api/notes/${fakeId}`, { title: "Hi", content: "x", version: 1 }],
      ["DELETE", `/api/notes/${fakeId}`],
      ["POST", `/api/notes/${fakeId}/ai`, { action: "summarize" }],
    ]) {
      const res = await ctx.request(method, path, body ? { body } : {});
      assert.equal(res.status, 401, `Expected 401 for ${method} ${path}`);
    }
  });

  it("creates notes, omits content in list, and enforces ownership 404", async () => {
    const createRes = await ctx.request("POST", "/api/notes", {
      token: userA.token,
      body: { title: "OS Deadlocks", content: "# Deadlocks\n\nCoffman conditions." },
    });
    assert.equal(createRes.status, 201);
    const noteA = createRes.data.note;
    assert.equal(noteA.title, "OS Deadlocks");
    assert.equal(noteA.version, 1);

    const listA = await ctx.request("GET", "/api/notes", { token: userA.token });
    assert.equal(listA.status, 200);
    assert.equal(listA.data.notes.length, 1);
    assert.equal("content" in listA.data.notes[0], false);
    assert.equal(listA.data.notes[0].id, noteA.id);
    assert.equal(listA.data.notes[0].version, 1);

    const listB = await ctx.request("GET", "/api/notes", { token: userB.token });
    assert.equal(listB.status, 200);
    assert.equal(listB.data.notes.length, 0);

    const getB = await ctx.request("GET", `/api/notes/${noteA.id}`, { token: userB.token });
    assert.equal(getB.status, 404);

    const putB = await ctx.request("PUT", `/api/notes/${noteA.id}`, {
      token: userB.token,
      body: { title: "Hacked", content: "Nope", version: 1 },
    });
    assert.equal(putB.status, 404);

    const delB = await ctx.request("DELETE", `/api/notes/${noteA.id}`, { token: userB.token });
    assert.equal(delB.status, 404);

    const aiB = await ctx.request("POST", `/api/notes/${noteA.id}/ai`, {
      token: userB.token,
      body: { action: "summarize" },
    });
    assert.equal(aiB.status, 404);
  });

  it("enforces optimistic concurrency with 409 on stale version and supports force overwrite", async () => {
    const createRes = await ctx.request("POST", "/api/notes", {
      token: userA.token,
      body: { title: "Concurrency", content: "v1" },
    });
    assert.equal(createRes.status, 201);
    const note = createRes.data.note;

    const update1 = await ctx.request("PUT", `/api/notes/${note.id}`, {
      token: userA.token,
      body: { title: "Concurrency", content: "v2", version: 1 },
    });
    assert.equal(update1.status, 200);
    assert.equal(update1.data.note.version, 2);
    assert.equal(update1.data.note.content, "v2");

    // Stale version 1 should return 409
    const staleRes = await ctx.request("PUT", `/api/notes/${note.id}`, {
      token: userA.token,
      body: { title: "Concurrency", content: "stale", version: 1 },
    });
    assert.equal(staleRes.status, 409);

    // Force overwrite should succeed and bump version to 3
    const forceRes = await ctx.request("PUT", `/api/notes/${note.id}`, {
      token: userA.token,
      body: { title: "Concurrency", content: "forced", version: 1, force: true },
    });
    assert.equal(forceRes.status, 200);
    assert.equal(forceRes.data.note.version, 3);
    assert.equal(forceRes.data.note.content, "forced");
  });

  it("validates content length and UUID params", async () => {
    const badIdRes = await ctx.request("GET", "/api/notes/not-a-uuid", { token: userA.token });
    assert.equal(badIdRes.status, 404);

    const tooLong = "a".repeat(100_001);
    const createTooLong = await ctx.request("POST", "/api/notes", {
      token: userA.token,
      body: { title: "Huge", content: tooLong },
    });
    assert.equal(createTooLong.status, 400);
  });

  it("returns AI preview without mutating note in DB and refunds quota on failure", async () => {
    const createRes = await ctx.request("POST", "/api/notes", {
      token: userA.token,
      body: { title: "DBMS", content: "Normalization reduces redundancy. Review 3NF before Friday." },
    });
    const note = createRes.data.note;

    // 1. Summarize preview does not mutate DB
    setCompleter(async () => "- Normalization reduces redundancy.");
    const sumRes = await ctx.request("POST", `/api/notes/${note.id}/ai`, {
      token: userA.token,
      body: { action: "summarize" },
    });
    assert.equal(sumRes.status, 200);
    assert.equal(sumRes.data.action, "summarize");
    assert.equal(sumRes.data.result, "- Normalization reduces redundancy.");

    const afterSum = await ctx.request("GET", `/api/notes/${note.id}`, { token: userA.token });
    assert.equal(afterSum.data.note.content, note.content);
    assert.equal(afterSum.data.note.version, note.version);

    // 2. Tasks preview returns validated array
    setCompleter(async () =>
      JSON.stringify([{ title: "Review 3NF", subject: "DBMS", dueDate: "2026-12-01" }])
    );
    const tasksRes = await ctx.request("POST", `/api/notes/${note.id}/ai`, {
      token: userA.token,
      body: { action: "tasks" },
    });
    assert.equal(tasksRes.status, 200);
    assert.equal(tasksRes.data.action, "tasks");
    assert.equal(tasksRes.data.result.length, 1);
    assert.equal(tasksRes.data.result[0].title, "Review 3NF");

    // 3. Quota refund on AI failure (limit = 1 for userB)
    process.env.AI_DAILY_LIMIT = "1";
    const createB = await ctx.request("POST", "/api/notes", {
      token: userB.token,
      body: { title: "Algo", content: "Dijkstra shortest path" },
    });
    const noteB = createB.data.note;

    setCompleter(async () => {
      throw new Error("Groq 502");
    });
    const failRes = await ctx.request("POST", `/api/notes/${noteB.id}/ai`, {
      token: userB.token,
      body: { action: "expand" },
    });
    assert.equal(failRes.status, 503);

    // Because quota was refunded, userB can still make 1 successful call
    setCompleter(async () => "Expanded Dijkstra notes");
    const okRes = await ctx.request("POST", `/api/notes/${noteB.id}/ai`, {
      token: userB.token,
      body: { action: "expand" },
    });
    assert.equal(okRes.status, 200);
    assert.equal(okRes.data.result, "Expanded Dijkstra notes");
  });

  it("deletes own note and returns 404 thereafter", async () => {
    const createRes = await ctx.request("POST", "/api/notes", {
      token: userA.token,
      body: { title: "Temp", content: "delete me" },
    });
    const id = createRes.data.note.id;

    const delRes = await ctx.request("DELETE", `/api/notes/${id}`, { token: userA.token });
    assert.equal(delRes.status, 200);

    const getRes = await ctx.request("GET", `/api/notes/${id}`, { token: userA.token });
    assert.equal(getRes.status, 404);
  });
});
