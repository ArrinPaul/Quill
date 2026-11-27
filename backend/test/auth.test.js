const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { startTestServer } = require("./helpers/testApp");

describe("Auth routes", () => {
  let ctx;

  before(async () => {
    ctx = await startTestServer();
  });

  after(async () => {
    await ctx.close();
  });

  it("registers a student and normalizes email to lowercase", async () => {
    const res = await ctx.request("POST", "/api/auth/register", {
      body: {
        name: "Alice",
        email: "  Alice@Example.COM ",
        password: "password123",
        branch: "CSE",
        year: 3,
      },
    });
    assert.equal(res.status, 200);
    assert.ok(res.data.token);
    assert.equal(res.data.student.email, "alice@example.com");
    assert.equal(res.data.student.password_hash, undefined);
  });

  it("rejects duplicate registration regardless of email case", async () => {
    const res = await ctx.request("POST", "/api/auth/register", {
      body: {
        name: "Alice Two",
        email: "ALICE@EXAMPLE.COM",
        password: "password123",
        branch: "CSE",
        year: 3,
      },
    });
    assert.equal(res.status, 400);
  });

  it("logs in with upper-case email", async () => {
    const res = await ctx.request("POST", "/api/auth/login", {
      body: {
        email: "ALICE@EXAMPLE.COM",
        password: "password123",
      },
    });
    assert.equal(res.status, 200);
    assert.ok(res.data.token);
    assert.equal(res.data.student.email, "alice@example.com");
  });

  it("rejects wrong password on login", async () => {
    const res = await ctx.request("POST", "/api/auth/login", {
      body: {
        email: "alice@example.com",
        password: "wrong-password",
      },
    });
    assert.equal(res.status, 401);
  });

  it("rejects session token after account is deleted", async () => {
    const bob = await ctx.registerStudent({ email: "bob-delete@example.com" });

    const beforeDelete = await ctx.request("GET", "/api/auth/me", { token: bob.token });
    assert.equal(beforeDelete.status, 200);

    const delRes = await ctx.request("DELETE", "/api/auth/me", { token: bob.token });
    assert.equal(delRes.status, 200);

    const afterDelete = await ctx.request("GET", "/api/auth/me", { token: bob.token });
    assert.equal(afterDelete.status, 401);

    const tasksAfterDelete = await ctx.request("GET", "/api/tasks", { token: bob.token });
    assert.equal(tasksAfterDelete.status, 401);
  });

  it("refuses password reset token as a session token", async () => {
    const carol = await ctx.registerStudent({ email: "carol-reset@example.com" });
    const resetToken = jwt.sign(
      {
        id: carol.student.id,
        email: carol.student.email,
        purpose: "password_reset",
        fp: "0123456789",
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const res = await ctx.request("GET", "/api/auth/me", { token: resetToken });
    assert.equal(res.status, 401);
  });

  it("rejects missing token", async () => {
    const res = await ctx.request("GET", "/api/auth/me");
    assert.equal(res.status, 401);
  });
});
