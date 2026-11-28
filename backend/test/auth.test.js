const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
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

  it("enforces minimum 8-char password on register, change-password, and reset-password while allowing legacy login", async () => {
    const shortReg = await ctx.request("POST", "/api/auth/register", {
      body: {
        name: "Short",
        email: "short-pw@example.com",
        password: "short77",
        branch: "CSE",
        year: 2,
      },
    });
    assert.equal(shortReg.status, 400);

    const user = await ctx.registerStudent({ email: "pw8-check@example.com" });

    const shortChange = await ctx.request("PUT", "/api/auth/password", {
      token: user.token,
      body: {
        currentPassword: user.password,
        newPassword: "short77",
      },
    });
    assert.equal(shortChange.status, 400);

    const { data: studentRow } = await ctx.db
      .from("students")
      .select("id, email, password_hash")
      .eq("id", user.student.id)
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

    const shortReset = await ctx.request("POST", "/api/auth/reset-password", {
      body: {
        token: resetToken,
        newPassword: "short77",
      },
    });
    assert.equal(shortReset.status, 400);

    // Existing account with a 6-char password can still log in
    const legacyHash = await bcrypt.hash("legacy", 10);
    await ctx.db.from("students").insert({
      name: "Legacy User",
      email: "legacy6@example.com",
      password_hash: legacyHash,
      branch: "CSE",
      year: 4,
      subjects: [],
    });

    const legacyLogin = await ctx.request("POST", "/api/auth/login", {
      body: {
        email: "legacy6@example.com",
        password: "legacy",
      },
    });
    assert.equal(legacyLogin.status, 200);
    assert.ok(legacyLogin.data.token);
  });

  it("handles email verification send (401, 503, DEV_MODE devCode, 1/min, 5/day)", async () => {
    const unauth = await ctx.request("POST", "/api/auth/verify/send");
    assert.equal(unauth.status, 401);

    const student = await ctx.registerStudent({ email: "verify-send@example.com" });
    assert.equal(student.student.email_verified, false);

    const prevResend = process.env.RESEND_API_KEY;
    const prevFrom = process.env.EMAIL_FROM;
    const prevDev = process.env.DEV_MODE;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.DEV_MODE;

    try {
      const unconfiguredRes = await ctx.request("POST", "/api/auth/verify/send", {
        token: student.token,
      });
      assert.equal(unconfiguredRes.status, 503);

      process.env.DEV_MODE = "true";
      const devRes = await ctx.request("POST", "/api/auth/verify/send", {
        token: student.token,
      });
      assert.equal(devRes.status, 200);
      assert.match(devRes.data.devCode, /^\d{6}$/);

      // 1 per minute rate limit
      const tooFastRes = await ctx.request("POST", "/api/auth/verify/send", {
        token: student.token,
      });
      assert.equal(tooFastRes.status, 429);

      // Backdate codes to test 5 per day limit
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const codesTable = ctx.db.tables.email_codes;
      codesTable[codesTable.length - 1].created_at = twoMinutesAgo;
      for (let i = 0; i < 4; i += 1) {
        codesTable.push({
          id: crypto.randomUUID(),
          student_id: student.student.id,
          code_hash: crypto.createHash("sha256").update(`00000${i}`).digest("hex"),
          expires_at: new Date(Date.now() - 1000).toISOString(),
          attempts: 0,
          created_at: new Date(Date.now() - (i + 3) * 60 * 1000).toISOString(),
        });
      }

      const dailyLimitRes = await ctx.request("POST", "/api/auth/verify/send", {
        token: student.token,
      });
      assert.equal(dailyLimitRes.status, 429);
    } finally {
      if (prevResend !== undefined) process.env.RESEND_API_KEY = prevResend;
      else delete process.env.RESEND_API_KEY;
      if (prevFrom !== undefined) process.env.EMAIL_FROM = prevFrom;
      else delete process.env.EMAIL_FROM;
      if (prevDev !== undefined) process.env.DEV_MODE = prevDev;
      else delete process.env.DEV_MODE;
    }
  });

  it("handles email verification confirm (401, wrong code 400 + 5-attempt lockout, expired, success + /auth/me)", async () => {
    const unauth = await ctx.request("POST", "/api/auth/verify", {
      body: { code: "123456" },
    });
    assert.equal(unauth.status, 401);

    const student = await ctx.registerStudent({ email: "verify-confirm@example.com" });

    const meBefore = await ctx.request("GET", "/api/auth/me", { token: student.token });
    assert.equal(meBefore.status, 200);
    assert.equal(meBefore.data.student.email_verified, false);

    const prevResend = process.env.RESEND_API_KEY;
    const prevFrom = process.env.EMAIL_FROM;
    const prevDev = process.env.DEV_MODE;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    process.env.DEV_MODE = "true";

    try {
      const sendRes = await ctx.request("POST", "/api/auth/verify/send", {
        token: student.token,
      });
      assert.equal(sendRes.status, 200);
      const validCode = sendRes.data.devCode;
      const wrongCode = validCode === "000000" ? "111111" : "000000";

      // 5 wrong attempts -> 400 each time, then locked out even for valid code
      for (let i = 0; i < 5; i += 1) {
        const badRes = await ctx.request("POST", "/api/auth/verify", {
          token: student.token,
          body: { code: wrongCode },
        });
        assert.equal(badRes.status, 400);
      }

      const lockedRes = await ctx.request("POST", "/api/auth/verify", {
        token: student.token,
        body: { code: validCode },
      });
      assert.equal(lockedRes.status, 400);

      // Simulate time passing > 1 min so a new code can be issued
      const studentCodes = ctx.db.tables.email_codes.filter((c) => c.student_id === student.student.id);
      for (const c of studentCodes) {
        c.created_at = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      }

      const resendRes = await ctx.request("POST", "/api/auth/verify/send", {
        token: student.token,
      });
      assert.equal(resendRes.status, 200);
      const freshCode = resendRes.data.devCode;

      // Expire the fresh code and verify 400
      const activeRow = ctx.db.tables.email_codes
        .filter((c) => c.student_id === student.student.id)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
      const savedExpiry = activeRow.expires_at;
      activeRow.expires_at = new Date(Date.now() - 1000).toISOString();

      const expiredRes = await ctx.request("POST", "/api/auth/verify", {
        token: student.token,
        body: { code: freshCode },
      });
      assert.equal(expiredRes.status, 400);

      // Restore expiry and verify success
      activeRow.expires_at = savedExpiry;
      const okRes = await ctx.request("POST", "/api/auth/verify", {
        token: student.token,
        body: { code: freshCode },
      });
      assert.equal(okRes.status, 200);
      assert.equal(okRes.data.email_verified, true);

      // Code should be deleted after verification
      assert.equal(
        ctx.db.tables.email_codes.some((c) => c.id === activeRow.id),
        false
      );

      const meAfter = await ctx.request("GET", "/api/auth/me", { token: student.token });
      assert.equal(meAfter.status, 200);
      assert.equal(meAfter.data.student.email_verified, true);
    } finally {
      if (prevResend !== undefined) process.env.RESEND_API_KEY = prevResend;
      else delete process.env.RESEND_API_KEY;
      if (prevFrom !== undefined) process.env.EMAIL_FROM = prevFrom;
      else delete process.env.EMAIL_FROM;
      if (prevDev !== undefined) process.env.DEV_MODE = prevDev;
      else delete process.env.DEV_MODE;
    }
  });
});
