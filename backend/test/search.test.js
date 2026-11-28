const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers/testApp");

describe("P4 GET /api/search", () => {
  let ctx;
  let userA;
  let userB;
  const search = (user, q) =>
    ctx.request("GET", `/api/search?q=${encodeURIComponent(q)}`, { token: user?.token });

  before(async () => {
    ctx = await startTestServer();
    userA = await ctx.registerStudent();
    userB = await ctx.registerStudent();
    const post = (path, body) => ctx.request("POST", path, { token: userA.token, body });
    await post("/api/tasks", { title: "Compiler lab", subject: "CS", deadline: "2026-12-01T10:00:00Z" });
    await post("/api/notes", { title: "Week 3", content: "the compiler front end" });
    await post("/api/flashcards/decks", { title: "Compiler terms", flashcards: [{ front: "a", back: "b" }] });
    await post("/api/whiteboards", { title: "Compiler pipeline", data: {} });
    for (let i = 0; i < 7; i += 1) {
      await post("/api/notes", { title: `Repeat ${i}`, content: "x" });
    }
    await post("/api/notes", { title: "100% sure", content: "x" });
  });
  after(() => ctx.close());

  it("finds matches across types, with a link that opens each one", async () => {
    const res = await search(userA, "COMPILER");
    assert.equal(res.status, 200);
    assert.deepEqual(res.data.results.map((r) => r.type).sort(), ["board", "deck", "note", "task"]);
    for (const r of res.data.results) {
      assert.ok(r.href.endsWith(`?open=${r.id}`));
    }
  });

  it("returns nothing belonging to another user", async () => {
    const res = await search(userB, "compiler");
    assert.deepEqual(res.data.results, []);
  });

  it("caps each type at 5", async () => {
    const res = await search(userA, "repeat");
    assert.equal(res.data.results.length, 5);
  });

  it("treats % and _ as plain text", async () => {
    assert.equal((await search(userA, "0%")).data.results.length, 1);
    assert.equal((await search(userA, "%%")).data.results.length, 0);
    assert.equal((await search(userA, "__")).data.results.length, 0);
  });

  it("refuses a missing token and a query that is too short or too long", async () => {
    assert.equal((await search(null, "compiler")).status, 401);
    assert.equal((await search(userA, "a")).status, 400);
    assert.equal((await search(userA, "a".repeat(101))).status, 400);
    assert.equal((await ctx.request("GET", "/api/search", { token: userA.token })).status, 400);
  });
});
