const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const app = require("../src/app");
const { startTestServer } = require("./helpers/testApp");

const RATE_LIMIT_MSG = /^Too many attempts\. Try again in \d+ minutes\.$/;

describe("Rate limiting", () => {
  let ctx;
  let prevEnable;

  before(async () => {
    prevEnable = process.env.ENABLE_RATE_LIMIT;
    process.env.ENABLE_RATE_LIMIT = "1";
    ctx = await startTestServer();
  });

  after(async () => {
    if (prevEnable === undefined) {
      delete process.env.ENABLE_RATE_LIMIT;
    } else {
      process.env.ENABLE_RATE_LIMIT = prevEnable;
    }
    await ctx.close();
  });

  it("configures trust proxy = 1 on the Express app", () => {
    assert.equal(app.get("trust proxy"), 1);
  });

  it("limits auth endpoints to 10 requests per 15 minutes per IP", async () => {
    const ip = "198.51.100.10";
    for (let i = 0; i < 10; i++) {
      const res = await ctx.request("POST", "/api/auth/check-email", {
        body: { email: `user${i}@example.com` },
        headers: { "X-Forwarded-For": ip },
      });
      assert.notEqual(res.status, 429, `Request ${i + 1} should not be rate limited`);
    }

    const blocked = await ctx.request("POST", "/api/auth/check-email", {
      body: { email: "user10@example.com" },
      headers: { "X-Forwarded-For": ip },
    });
    assert.equal(blocked.status, 429);
    assert.match(blocked.data.message, RATE_LIMIT_MSG);

    // Different IP is still allowed
    const otherIp = await ctx.request("POST", "/api/auth/check-email", {
      body: { email: "other@example.com" },
      headers: { "X-Forwarded-For": "198.51.100.11" },
    });
    assert.notEqual(otherIp.status, 429);
  });

  it("limits login to 10 requests per 15 minutes per email across IPs", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await ctx.request("POST", "/api/auth/login", {
        body: { email: "target@example.com", password: "wrong" },
        headers: { "X-Forwarded-For": `198.51.101.${i + 1}` },
      });
      assert.equal(res.status, 401);
    }

    const blocked = await ctx.request("POST", "/api/auth/login", {
      body: { email: "  TARGET@Example.com ", password: "wrong" },
      headers: { "X-Forwarded-For": "198.51.101.50" },
    });
    assert.equal(blocked.status, 429);
    assert.match(blocked.data.message, RATE_LIMIT_MSG);

    // Different email from a fresh IP is not blocked
    const otherEmail = await ctx.request("POST", "/api/auth/login", {
      body: { email: "someone-else@example.com", password: "wrong" },
      headers: { "X-Forwarded-For": "198.51.101.51" },
    });
    assert.equal(otherEmail.status, 401);
  });

  it("limits /api/ai/* to 30 requests per hour per user and exempts /api/ai/tip", async () => {
    const { token } = await ctx.registerStudent({ email: "ai-user1@example.com" });
    const { token: otherToken } = await ctx.registerStudent({ email: "ai-user2@example.com" });

    for (let i = 0; i < 30; i++) {
      const res = await ctx.request("POST", "/api/ai/parse-document", {
        token,
        headers: { "X-Forwarded-For": "198.51.102.1" },
      });
      assert.equal(res.status, 400, `AI request ${i + 1} should reach route handler`);
    }

    const blocked = await ctx.request("POST", "/api/ai/parse-document", {
      token,
      headers: { "X-Forwarded-For": "198.51.102.2" },
    });
    assert.equal(blocked.status, 429);
    assert.match(blocked.data.message, RATE_LIMIT_MSG);

    // /api/ai/tip is exempt from AI rate limit
    const tipRes = await ctx.request("GET", "/api/ai/tip", {
      token,
      headers: { "X-Forwarded-For": "198.51.102.1" },
    });
    assert.notEqual(tipRes.status, 429);

    // Different user is not blocked even from the same IP
    const otherUserRes = await ctx.request("POST", "/api/ai/parse-document", {
      token: otherToken,
      headers: { "X-Forwarded-For": "198.51.102.1" },
    });
    assert.equal(otherUserRes.status, 400);
  });

  it("limits general /api routes to 300 requests per 5 minutes per user or IP", async () => {
    const ip = "198.51.103.10";
    for (let i = 0; i < 300; i++) {
      const res = await ctx.request("GET", "/api/health", {
        headers: { "X-Forwarded-For": ip },
      });
      assert.equal(res.status, 200);
    }

    const blocked = await ctx.request("GET", "/api/health", {
      headers: { "X-Forwarded-For": ip },
    });
    assert.equal(blocked.status, 429);
    assert.match(blocked.data.message, RATE_LIMIT_MSG);

    const otherIp = await ctx.request("GET", "/api/health", {
      headers: { "X-Forwarded-For": "198.51.103.11" },
    });
    assert.equal(otherIp.status, 200);
  });
});
