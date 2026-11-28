const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getClient } = require("../services/supabase");
const authMiddleware = require("../middleware/auth");
const validate = require("../middleware/validate");
const { authIpLimiter, loginEmailLimiter } = require("../middleware/rateLimit");
const {
  checkEmailSchema,
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} = require("../schemas/auth");
const { isEmailConfigured, sendPasswordReset, sendVerificationCode } = require("../services/email");

const router = express.Router();

const STUDENT_PUBLIC_FIELDS = "id, name, email, branch, year, subjects, email_verified_at, created_at";

function serializeStudent(student) {
  const { password_hash, ...rest } = student;
  return {
    ...rest,
    email_verified: Boolean(student.email_verified_at),
  };
}

function signSessionToken(student, tokenVersion = student.token_version ?? 0) {
  return jwt.sign(
    { id: student.id, email: student.email, tv: tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

router.post("/check-email", authIpLimiter, validate({ body: checkEmailSchema }), async (req, res, next) => {
  try {
    const { email } = req.body;

    const { data: existing, error } = await getClient()
      .from("students")
      .select("id")
      .eq("email", email)
      .limit(1);

    if (error) throw error;
    if (existing && existing.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    res.json({ available: true });
  } catch (error) {
    next(error);
  }
});

router.post("/register", authIpLimiter, validate({ body: registerSchema }), async (req, res, next) => {
  try {
    const { name, email, password, branch, year, subjects } = req.body;

    const { data: existing, error: existingError } = await getClient()
      .from("students")
      .select("id")
      .eq("email", email)
      .limit(1);

    if (existingError) throw existingError;
    if (existing && existing.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const { data: student, error } = await getClient()
      .from("students")
      .insert({
        name,
        email,
        password_hash,
        branch,
        year,
        subjects,
      })
      .select(STUDENT_PUBLIC_FIELDS)
      .single();

    if (error) throw error;

    const token = signSessionToken(student);

    res.json({ token, student: serializeStudent(student) });
  } catch (error) {
    next(error);
  }
});

router.post("/login", authIpLimiter, loginEmailLimiter, validate({ body: loginSchema }), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { data: student, error } = await getClient()
      .from("students")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !student) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, student.password_hash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signSessionToken(student);

    res.json({ token, student: serializeStudent(student) });
  } catch (error) {
    next(error);
  }
});

router.get("/me", authMiddleware, async (req, res, next) => {
  try {
    if (req.student.id === "00000000-0000-0000-0000-000000000000") {
      return res.json({ student: { ...req.student, email_verified: true } });
    }

    const { data: student, error } = await getClient()
      .from("students")
      .select(STUDENT_PUBLIC_FIELDS)
      .eq("id", req.student.id)
      .single();

    if (error || !student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json({ student: serializeStudent(student) });
  } catch (error) {
    next(error);
  }
});

router.put("/me", authMiddleware, validate({ body: updateProfileSchema }), async (req, res, next) => {
  try {
    const { name, branch, year, subjects } = req.body;

    const { data: student, error } = await getClient()
      .from("students")
      .update({ name, branch, year, subjects })
      .eq("id", req.student.id)
      .select(STUDENT_PUBLIC_FIELDS)
      .single();

    if (error) throw error;
    res.json({ student: serializeStudent(student) });
  } catch (error) {
    next(error);
  }
});

router.put("/password", authMiddleware, validate({ body: changePasswordSchema }), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const supabase = getClient();
    const { data: student, error: fetchError } = await supabase
      .from("students")
      .select("id, email, password_hash, token_version")
      .eq("id", req.student.id)
      .single();

    if (fetchError || !student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const valid = await bcrypt.compare(currentPassword, student.password_hash);
    if (!valid) {
      // Not 401: the web app treats that as an expired session and signs the user out.
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    const nextTokenVersion = (student.token_version ?? 0) + 1;
    const { error: updateError } = await supabase
      .from("students")
      .update({ password_hash, token_version: nextTokenVersion })
      .eq("id", req.student.id);

    if (updateError) throw updateError;
    const token = signSessionToken(student, nextTokenVersion);
    res.json({ message: "Password updated successfully", token });
  } catch (error) {
    next(error);
  }
});

router.post("/forgot-password", authIpLimiter, validate({ body: forgotPasswordSchema }), async (req, res, next) => {
  try {
    const { email } = req.body;

    // Without an email provider, the link is only ever shown on a local development server
    const showLink = !isEmailConfigured() && process.env.DEV_MODE === "true" && process.env.NODE_ENV !== "production";
    if (!isEmailConfigured() && !showLink) {
      return res.status(503).json({ message: "Password reset email is not set up on this server." });
    }

    // Same message either way, so this can't be used to discover accounts
    const message = "If an account with that email exists, a password reset link has been sent.";

    const { data: student } = await getClient()
      .from("students")
      .select("id, email, password_hash")
      .eq("email", email)
      .maybeSingle();

    if (!student) return res.json({ message });

    const resetToken = jwt.sign(
      {
        id: student.id,
        email: student.email,
        purpose: "password_reset",
        fp: student.password_hash.slice(-10),
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").split(",")[0].trim().replace(/\/$/, "");
    const resetUrl = `${frontendUrl}/forgot-password?token=${resetToken}`;

    if (showLink) return res.json({ message, resetUrl });

    // Not awaited: response time shouldn't reveal whether the account exists
    sendPasswordReset(student.email, resetUrl).catch((err) => console.error("Password reset email failed:", err.message));
    res.json({ message });
  } catch (error) {
    next(error);
  }
});

router.post("/reset-password", authIpLimiter, validate({ body: resetPasswordSchema }), async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ message: "Invalid or expired reset link" });
    }

    if (decoded.purpose !== "password_reset") {
      return res.status(400).json({ message: "Invalid reset token" });
    }

    const supabase = getClient();
    const { data: student, error: fetchError } = await supabase
      .from("students")
      .select("id, password_hash, token_version")
      .eq("id", decoded.id)
      .single();

    if (fetchError || !student || student.password_hash.slice(-10) !== decoded.fp) {
      return res.status(400).json({ message: "Reset link has already been used or is invalid" });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    const nextTokenVersion = (student.token_version ?? 0) + 1;
    const { error: updateError } = await supabase
      .from("students")
      .update({ password_hash, token_version: nextTokenVersion })
      .eq("id", student.id);

    if (updateError) throw updateError;
    res.json({ message: "Password has been reset successfully. You can now log in." });
  } catch (error) {
    next(error);
  }
});

async function handleStudyGroupsOnAccountDelete(supabase, studentId) {
  const { data: ownedGroups, error: ownedError } = await supabase
    .from("study_groups")
    .select("id")
    .eq("owner_id", studentId);
  if (ownedError) throw ownedError;

  for (const group of ownedGroups || []) {
    const { data: members, error: memError } = await supabase
      .from("study_group_members")
      .select("student_id, role, joined_at")
      .eq("group_id", group.id)
      .order("joined_at", { ascending: true });
    if (memError) throw memError;

    const others = (members || []).filter((m) => m.student_id !== studentId);
    const successor = others.find((m) => m.role === "admin") || others[0];

    if (successor) {
      const { error: delOwnerMemError } = await supabase
        .from("study_group_members")
        .delete()
        .eq("group_id", group.id)
        .eq("student_id", studentId);
      if (delOwnerMemError) throw delOwnerMemError;

      const { error: promoteError } = await supabase
        .from("study_group_members")
        .update({ role: "owner" })
        .eq("group_id", group.id)
        .eq("student_id", successor.student_id);
      if (promoteError) throw promoteError;

      const { error: updateGroupError } = await supabase
        .from("study_groups")
        .update({
          owner_id: successor.student_id,
          realtime_key: crypto.randomBytes(24).toString("hex"),
        })
        .eq("id", group.id);
      if (updateGroupError) throw updateGroupError;
    } else {
      const { error: delGroupError } = await supabase
        .from("study_groups")
        .delete()
        .eq("id", group.id);
      if (delGroupError) throw delGroupError;
    }
  }

  const { data: remainingMemberships, error: remError } = await supabase
    .from("study_group_members")
    .select("group_id")
    .eq("student_id", studentId);
  if (remError) throw remError;

  for (const m of remainingMemberships || []) {
    const { error: delMemError } = await supabase
      .from("study_group_members")
      .delete()
      .eq("group_id", m.group_id)
      .eq("student_id", studentId);
    if (delMemError) throw delMemError;

    const { error: rotateError } = await supabase
      .from("study_groups")
      .update({ realtime_key: crypto.randomBytes(24).toString("hex") })
      .eq("id", m.group_id);
    if (rotateError) throw rotateError;
  }
}

router.delete("/me", authMiddleware, async (req, res, next) => {
  try {
    const supabase = getClient();
    const studentId = req.student.id;

    await handleStudyGroupsOnAccountDelete(supabase, studentId);

    await supabase.from("preferences").delete().eq("user_id", studentId);
    await supabase.from("tasks").delete().eq("student_id", studentId);
    await supabase.from("flashcard_decks").delete().eq("student_id", studentId);
    await supabase.from("quizzes").delete().eq("student_id", studentId);

    // Finally, delete the student record
    const { data, error } = await supabase
      .from("students")
      .delete()
      .eq("id", studentId)
      .select("id");

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    next(error);
  }
});

router.post("/verify/send", authMiddleware, async (req, res, next) => {
  try {
    const emailConfigured = isEmailConfigured();
    const showDevCode = !emailConfigured && process.env.DEV_MODE === "true" && process.env.NODE_ENV !== "production";
    if (!emailConfigured && !showDevCode) {
      return res.status(503).json({ message: "Verification email is not set up on this server." });
    }

    const supabase = getClient();
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, email, email_verified_at")
      .eq("id", req.student.id)
      .maybeSingle();

    if (studentError) throw studentError;
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    if (student.email_verified_at) {
      return res.status(400).json({ message: "Email is already verified" });
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const expiredPrevIso = new Date(now - 1000).toISOString();
    const oneMinuteAgoIso = new Date(now - 60 * 1000).toISOString();
    const oneDayAgoIso = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentCodes, error: recentError } = await supabase
      .from("email_codes")
      .select("id, created_at")
      .eq("student_id", student.id)
      .gte("created_at", oneDayAgoIso);

    if (recentError) throw recentError;

    if ((recentCodes || []).length >= 5) {
      return res.status(429).json({ message: "Daily verification limit reached. Try again tomorrow." });
    }
    if ((recentCodes || []).some((c) => c.created_at >= oneMinuteAgoIso)) {
      return res.status(429).json({ message: "Please wait a minute before requesting another code." });
    }

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");

    // Keep only one active code per student without deleting today's rate-limit history
    const { error: expireError } = await supabase
      .from("email_codes")
      .update({ expires_at: expiredPrevIso })
      .eq("student_id", student.id)
      .gte("expires_at", nowIso);

    if (expireError) throw expireError;

    const { data: insertedCode, error: insertError } = await supabase
      .from("email_codes")
      .insert({
        student_id: student.id,
        code_hash: codeHash,
        expires_at: new Date(now + 10 * 60 * 1000).toISOString(),
        attempts: 0,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    if (showDevCode) {
      return res.json({ message: "Verification code generated.", devCode: code });
    }

    try {
      await sendVerificationCode(student.email, code);
    } catch (err) {
      await supabase.from("email_codes").delete().eq("id", insertedCode.id);
      console.error("Verification email failed:", err.message);
      return res.status(503).json({ message: "Could not send verification email. Please try again." });
    }

    res.json({ message: "Verification code sent to your email." });
  } catch (error) {
    next(error);
  }
});

router.post("/verify", authMiddleware, validate({ body: verifyEmailSchema }), async (req, res, next) => {
  try {
    const { code } = req.body;
    const supabase = getClient();
    const nowIso = new Date().toISOString();

    const { data: codes, error: codeError } = await supabase
      .from("email_codes")
      .select("id, code_hash, expires_at, attempts")
      .eq("student_id", req.student.id)
      .gte("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1);

    if (codeError) throw codeError;

    const activeCode = codes && codes[0];
    if (!activeCode) {
      return res.status(400).json({ message: "Verification code is invalid or has expired." });
    }
    if ((activeCode.attempts ?? 0) >= 5) {
      return res.status(400).json({ message: "Too many incorrect attempts. Please request a new code." });
    }

    const submittedHash = crypto.createHash("sha256").update(code).digest("hex");
    const a = Buffer.from(submittedHash, "hex");
    const b = Buffer.from(activeCode.code_hash, "hex");
    const matches = a.length === b.length && crypto.timingSafeEqual(a, b);

    if (!matches) {
      const nextAttempts = (activeCode.attempts ?? 0) + 1;
      const { error: attemptError } = await supabase
        .from("email_codes")
        .update({ attempts: nextAttempts })
        .eq("id", activeCode.id);
      if (attemptError) throw attemptError;

      return res.status(400).json({
        message:
          nextAttempts >= 5
            ? "Too many incorrect attempts. Please request a new code."
            : "Incorrect verification code.",
      });
    }

    const { error: verifyError } = await supabase
      .from("students")
      .update({ email_verified_at: nowIso })
      .eq("id", req.student.id);
    if (verifyError) throw verifyError;

    const { error: deleteError } = await supabase
      .from("email_codes")
      .delete()
      .eq("id", activeCode.id);
    if (deleteError) throw deleteError;

    res.json({ message: "Email verified successfully.", email_verified: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
