const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers/testApp");

describe("Notices ownership and validation", () => {
  let ctx;
  let userA;
  let userB;
  let noticeA;

  before(async () => {
    ctx = await startTestServer();
    userA = await ctx.registerStudent();
    userB = await ctx.registerStudent();
  });

  after(async () => {
    await ctx.close();
  });

  it("rejects unauthenticated requests", async () => {
    const res = await ctx.request("GET", "/api/notices");
    assert.equal(res.status, 401);
  });

  it("validates notice_text on create", async () => {
    const res = await ctx.request("POST", "/api/notices", {
      token: userA.token,
      body: { event_title: "Exam" },
    });
    assert.equal(res.status, 400);
  });

  it("creates a notice for user A and hides it from user B", async () => {
    const createRes = await ctx.request("POST", "/api/notices", {
      token: userA.token,
      body: { notice_text: "Midterm on Friday", event_title: "Midterm", event_date: "2026-12-01" },
    });
    assert.equal(createRes.status, 200);
    noticeA = createRes.data.notice;

    const listB = await ctx.request("GET", "/api/notices", { token: userB.token });
    assert.equal(listB.status, 200);
    assert.equal(listB.data.notices.length, 0);
  });

  it("returns 404 when user B updates or deletes user A's notice", async () => {
    const putB = await ctx.request("PUT", `/api/notices/${noticeA.id}`, {
      token: userB.token,
      body: { notice_text: "Tampered" },
    });
    assert.equal(putB.status, 404);

    const delB = await ctx.request("DELETE", `/api/notices/${noticeA.id}`, {
      token: userB.token,
    });
    assert.equal(delB.status, 404);

    const listA = await ctx.request("GET", "/api/notices", { token: userA.token });
    assert.equal(listA.data.notices.length, 1);
    assert.equal(listA.data.notices[0].notice_text, "Midterm on Friday");
  });
});
