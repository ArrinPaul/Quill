const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers/testApp");

describe("Calendar feed signature", () => {
  let ctx;
  let userA;
  let userB;

  before(async () => {
    ctx = await startTestServer();
    userA = await ctx.registerStudent();
    userB = await ctx.registerStudent();

    await ctx.request("POST", "/api/tasks", {
      token: userA.token,
      body: {
        title: "Calendar Task",
        subject: "MATH101",
        deadline: new Date(Date.now() + 86400_000).toISOString(),
      },
    });

    await ctx.request("POST", "/api/tasks", {
      token: userA.token,
      body: {
        title: "In Progress Calendar Task",
        subject: "MATH101",
        deadline: new Date(Date.now() + 86400_000).toISOString(),
        status: "in_progress",
      },
    });

    await ctx.request("POST", "/api/tasks", {
      token: userA.token,
      body: {
        title: "Cancelled Calendar Task",
        subject: "MATH101",
        deadline: new Date(Date.now() + 86400_000).toISOString(),
        status: "cancelled",
      },
    });
  });

  after(async () => {
    await ctx.close();
  });

  it("requires auth for GET /api/calendar/feed-url", async () => {
    const res = await ctx.request("GET", "/api/calendar/feed-url");
    assert.equal(res.status, 401);
  });

  it("serves .ics feed for a valid signature and rejects missing, tampered, or cross-user signatures", async () => {
    const urlRes = await ctx.request("GET", "/api/calendar/feed-url", { token: userA.token });
    assert.equal(urlRes.status, 200);
    assert.ok(urlRes.data.path.startsWith(`/api/calendar/feed/${userA.student.id}?token=`));

    const validFeed = await ctx.request("GET", urlRes.data.path);
    assert.equal(validFeed.status, 200);
    assert.match(validFeed.headers.get("content-type") || "", /text\/calendar/);
    assert.match(validFeed.text, /BEGIN:VCALENDAR/);
    assert.match(validFeed.text, /Calendar Task/);
    assert.match(validFeed.text, /In Progress Calendar Task/);
    assert.doesNotMatch(validFeed.text, /Cancelled Calendar Task/);

    const noToken = await ctx.request("GET", `/api/calendar/feed/${userA.student.id}`);
    assert.equal(noToken.status, 401);

    const tampered = await ctx.request("GET", `/api/calendar/feed/${userA.student.id}?token=deadbeef`);
    assert.equal(tampered.status, 401);

    const tokenA = urlRes.data.path.split("token=")[1];
    const crossUser = await ctx.request("GET", `/api/calendar/feed/${userB.student.id}?token=${tokenA}`);
    assert.equal(crossUser.status, 401);
  });
});
