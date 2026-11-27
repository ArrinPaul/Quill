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

  it("revokes old and legacy tokens on password change and returns a working fresh token", async () => {
    const dave = await ctx.registerStudent({ email: "dave-pw-change@example.com" });
    assert.equal(jwt.decode(dave.token).tv, 0);

    const legacyToken = jwt.sign(
      { id: dave.student.id, email: dave.student.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const legacyBefore = await ctx.request("GET", "/api/auth/me", { token: legacyToken });
    assert.equal(legacyBefore.status, 200);

    const changeRes = await ctx.request("PUT", "/api/auth/password", {
      token: dave.token,
      body: {
        currentPassword: dave.password,
        newPassword: "newpassword123",
      },
    });
    assert.equal(changeRes.status, 200);
    assert.ok(changeRes.data.token);
    assert.equal(jwt.decode(changeRes.data.token).tv, 1);

    const oldAfter = await ctx.request("GET", "/api/auth/me", { token: dave.token });
    assert.equal(oldAfter.status, 401);

    const legacyAfter = await ctx.request("GET", "/api/auth/me", { token: legacyToken });
    assert.equal(legacyAfter.status, 401);

    const freshAfter = await ctx.request("GET", "/api/auth/me", { token: changeRes.data.token });
    assert.equal(freshAfter.status, 200);
  });

  it("revokes old tokens on password reset", async () => {
    const eve = await ctx.registerStudent({ email: "eve-pw-reset@example.com" });

    const { data: studentRow } = await ctx.db
      .from("students")
      .select("id, email, password_hash")
      .eq("id", eve.student.id)
      .single();

    const resetToken = jwt.sign(
      {
        id: studentRow.id,
        email: studentRow.email,
        purpose: "password_reset",
        fp: studentRow.password_hash.slice(-10),
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const resetRes = await ctx.request("POST", "/api/auth/reset-password", {
      body: {
        token: resetToken,
        newPassword: "resetpassword123",
      },
    });
    assert.equal(resetRes.status, 200);

    const oldAfterReset = await ctx.request("GET", "/api/auth/me", { token: eve.token });
    assert.equal(oldAfterReset.status, 401);

    const loginRes = await ctx.request("POST", "/api/auth/login", {
      body: {
        email: eve.student.email,
        password: "resetpassword123",
      },
    });
    assert.equal(loginRes.status, 200);
    assert.equal(jwt.decode(loginRes.data.token).tv, 1);

    const freshMe = await ctx.request("GET", "/api/auth/me", { token: loginRes.data.token });
    assert.equal(freshMe.status, 200);
  });
});
