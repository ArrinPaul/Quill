const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers/testApp");

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

    await ctx.request("DELETE", `/api/whiteboards/${boardA.id}`, { token: userB.token });

    const getA = await ctx.request("GET", `/api/whiteboards/${boardA.id}`, { token: userA.token });
    assert.equal(getA.status, 200);
    assert.equal(getA.data.whiteboard.title, "Architecture");
  });
});
