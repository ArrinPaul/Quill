const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startTestServer } = require("./helpers/testApp");

describe("weekly digest batching", () => {
  let ctx;
  const realFetch = global.fetch;

  before(async () => {
    process.env.CRON_SECRET = "cron-test-secret";
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Quill <test@example.com>";
    // 60 subscribers with nothing due, then one who has a task
    const students = Array.from({ length: 61 }, (_, i) => ({ id: `s${i}`, email: `s${i}@example.com`, email_digest: true }));
    ctx = await startTestServer({
      students,
      tasks: [{ id: "t1", student_id: "s60", title: "Essay", status: "pending", deadline: new Date(Date.now() + 86400000).toISOString() }],
    });
    global.fetch = async (url, options) =>
      String(url).startsWith("https://api.resend.com") ? new Response("{}") : realFetch(url, options);
  });
  after(async () => {
    global.fetch = realFetch;
    delete process.env.CRON_SECRET;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    await ctx.close();
  });

  it("reaches a subscriber behind 60 others who have nothing to report", async () => {
    const res = await ctx.request("POST", "/api/jobs/digest", { headers: { "x-cron-secret": "cron-test-secret" } });
    assert.equal(res.data.sent, 1);
  });
});
