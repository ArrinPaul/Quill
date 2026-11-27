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
} = require("../schemas/auth");
const { isEmailConfigured, sendPasswordReset } = require("../services/email");

const router = express.Router();

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
      .select("id, name, email, branch, year, subjects, created_at")
      .single();

    if (error) throw error;

    const token = jwt.sign(
      { id: student.id, email: student.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, student });
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

    const token = jwt.sign(
      { id: student.id, email: student.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const { password_hash, ...studentData } = student;
    res.json({ token, student: studentData });
  } catch (error) {
    next(error);
  }
});

router.get("/me", authMiddleware, async (req, res, next) => {
  try {
    if (req.student.id === "00000000-0000-0000-0000-000000000000") {
      return res.json({ student: req.student });
    }

    const { data: student, error } = await getClient()
      .from("students")
      .select("id, name, email, branch, year, subjects, created_at")
      .eq("id", req.student.id)
      .single();

    if (error || !student) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json({ student });
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
      .select("id, name, email, branch, year, subjects, created_at")
      .single();

    if (error) throw error;
    res.json({ student });
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
      .select("id, password_hash")
      .eq("id", req.student.id)
      .single();

    if (fetchError || !student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const valid = await bcrypt.compare(currentPassword, student.password_hash);
    if (!valid) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    const { error: updateError } = await supabase
      .from("students")
      .update({ password_hash })
      .eq("id", req.student.id);

    if (updateError) throw updateError;
    res.json({ message: "Password updated successfully" });
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
      .select("id, password_hash")
      .eq("id", decoded.id)
      .single();

    if (fetchError || !student || student.password_hash.slice(-10) !== decoded.fp) {
      return res.status(400).json({ message: "Reset link has already been used or is invalid" });
    }

    const password_hash = await bcrypt.hash(newPassword, 10);
    const { error: updateError } = await supabase
      .from("students")
      .update({ password_hash })
      .eq("id", student.id);

    if (updateError) throw updateError;
    res.json({ message: "Password has been reset successfully. You can now log in." });
  } catch (error) {
    next(error);
  }
});

router.delete("/me", authMiddleware, async (req, res, next) => {
  try {
    const supabase = getClient();
    const studentId = req.student.id;

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

module.exports = router;
