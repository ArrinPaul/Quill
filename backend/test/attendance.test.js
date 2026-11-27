const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers/testApp");

describe("Attendance ownership and validation", () => {
  let ctx;
  let userA;
  let userB;
  let recordA;

  before(async () => {
    ctx = await startTestServer();
    userA = await ctx.registerStudent();
    userB = await ctx.registerStudent();
  });

  after(async () => {
    await ctx.close();
  });

  it("rejects unauthenticated requests", async () => {
    const res = await ctx.request("GET", "/api/attendance");
    assert.equal(res.status, 401);
  });

  it("validates attended_classes <= total_classes", async () => {
    const res = await ctx.request("POST", "/api/attendance", {
      token: userA.token,
      body: { subject: "CS101", total_classes: 5, attended_classes: 6 },
    });
    assert.equal(res.status, 400);
  });

  it("creates attendance for user A and prevents user B from viewing or deleting it", async () => {
    const createRes = await ctx.request("POST", "/api/attendance", {
      token: userA.token,
      body: { subject: "CS101", total_classes: 10, attended_classes: 8, threshold: 75 },
    });
    assert.equal(createRes.status, 200);
    recordA = createRes.data.attendance;

    const listB = await ctx.request("GET", "/api/attendance", { token: userB.token });
    assert.equal(listB.status, 200);
    assert.equal(listB.data.attendance.length, 0);

    await ctx.request("DELETE", `/api/attendance/${recordA.id}`, { token: userB.token });

    const listA = await ctx.request("GET", "/api/attendance", { token: userA.token });
    assert.equal(listA.data.attendance.length, 1);
    assert.equal(listA.data.attendance[0].subject, "CS101");
  });
});
