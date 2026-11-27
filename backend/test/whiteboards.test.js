const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { startTestServer } = require("./helpers/testApp");
const { setClient } = require("../src/services/supabase");

const LOCAL_DB_PATH = path.join(__dirname, "../whiteboards_db.json");

describe("Whiteboards ownership", () => {
  let ctx;
  let userA;
  let userB;
  let boardA;

  before(async () => {
    ctx = await startTestServer();
    userA = await ctx.registerStudent();
    userB = await ctx.registerStudent();
  });

  after(async () => {
    await ctx.close();
  });

  it("rejects unauthenticated requests", async () => {
    const res = await ctx.request("GET", "/api/whiteboards");
    assert.equal(res.status, 401);
  });

  it("creates a whiteboard for user A and enforces ownership for user B", async () => {
    const createRes = await ctx.request("POST", "/api/whiteboards", {
      token: userA.token,
      body: { title: "Architecture", data: { nodes: [] } },
    });
    assert.equal(createRes.status, 200);
    boardA = createRes.data.whiteboard;

    const listB = await ctx.request("GET", "/api/whiteboards", { token: userB.token });
    assert.equal(listB.status, 200);
    assert.equal(listB.data.whiteboards.length, 0);

    const getB = await ctx.request("GET", `/api/whiteboards/${boardA.id}`, { token: userB.token });
    assert.equal(getB.status, 404);

    const putB = await ctx.request("PUT", `/api/whiteboards/${boardA.id}`, {
      token: userB.token,
      body: { title: "Tampered" },
    });
    assert.equal(putB.status, 404);

    const delB = await ctx.request("DELETE", `/api/whiteboards/${boardA.id}`, { token: userB.token });
    assert.equal(delB.status, 404);

    const getA = await ctx.request("GET", `/api/whiteboards/${boardA.id}`, { token: userA.token });
    assert.equal(getA.status, 200);
    assert.equal(getA.data.whiteboard.title, "Architecture");

    assert.equal(fs.existsSync(LOCAL_DB_PATH), false);
  });

  it("returns 500 without falling back to local filesystem on DB failure", async () => {
    const originalDb = ctx.db;
    const dbFailure = { data: null, error: new Error("FATAL: connection refused to postgres") };
    const failingBuilder = {
      select() { return this; },
      insert() { return this; },
      update() { return this; },
      delete() { return this; },
      eq() { return this; },
      order() { return Promise.resolve(dbFailure); },
      single() { return Promise.resolve(dbFailure); },
      maybeSingle() { return Promise.resolve(dbFailure); },
    };

    setClient({
      from(table) {
        if (table === "students") {
          return originalDb.from(table);
        }
        return failingBuilder;
      },
    });

    try {
      const listRes = await ctx.request("GET", "/api/whiteboards", { token: userA.token });
      assert.equal(listRes.status, 500);
      assert.deepEqual(listRes.data, { message: "Something went wrong" });

      const putRes = await ctx.request("PUT", `/api/whiteboards/${boardA.id}`, {
        token: userA.token,
        body: { title: "Updated" },
      });
      assert.equal(putRes.status, 500);
      assert.deepEqual(putRes.data, { message: "Something went wrong" });

      assert.equal(fs.existsSync(LOCAL_DB_PATH), false);
    } finally {
      setClient(originalDb);
    }
  });
});
