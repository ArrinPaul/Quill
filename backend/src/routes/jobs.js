const crypto = require("crypto");
const express = require("express");
const { getClient } = require("../services/supabase");
const { isEmailConfigured, sendEmail } = require("../services/email");
const { unsubscribeUrl } = require("../services/unsubscribe");

const router = express.Router();

const BATCH = 50;
const OPEN = ["pending", "in_progress"];
// A weekly job may run a little early or late, so allow slightly under seven days.
const DIGEST_GAP_MS = 6 * 86400000;

// Called by a scheduler, which has a shared secret instead of a login.
router.use((req, res, next) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ message: "Scheduled jobs are not set up on this server." });
  const hash = (v) => crypto.createHash("sha256").update(String(v)).digest();
  if (!crypto.timingSafeEqual(hash(req.get("x-cron-secret") || ""), hash(secret))) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (!isEmailConfigured()) return res.status(503).json({ message: "Email is not set up on this server." });
  next();
});

const when = (iso) => `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC`;

router.post("/reminders", async (req, res, next) => {
  try {
    const supabase = getClient();
    const now = new Date().toISOString();

    const { data: students, error: studentError } = await supabase
      .from("students")
      .select("id, email")
      .eq("email_reminders", true);
    if (studentError) throw studentError;
    if (!students?.length) return res.json({ sent: 0, failed: 0 });
    const emails = new Map(students.map((s) => [s.id, s.email]));

    const { data: due, error } = await supabase
      .from("tasks")
      .select("id, student_id, title, deadline")
      .in("student_id", [...emails.keys()])
      .in("status", OPEN)
      .lte("reminder_time", now)
      .gte("deadline", now)
      .is("reminder_sent_at", null)
      .order("deadline", { ascending: true })
      .limit(BATCH);
    if (error) throw error;

    let sent = 0;
    let failed = 0;
    for (const task of due || []) {
      // Claim before sending, so two runs at once cannot send the same reminder.
      const { data: claimed, error: claimError } = await supabase
        .from("tasks")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", task.id)
        .is("reminder_sent_at", null)
        .select("id");
      if (claimError) throw claimError;
      if (!claimed?.length) continue;

      try {
        await sendEmail(
          emails.get(task.student_id),
          `Reminder: ${task.title}`.slice(0, 200),
          `"${task.title}" is due ${when(task.deadline)}.\n\nTurn reminders off in Quill under Settings.`
        );
        sent += 1;
      } catch (err) {
        console.error("Reminder email failed:", err.message);
        failed += 1;
        await supabase.from("tasks").update({ reminder_sent_at: null }).eq("id", task.id);
      }
    }
    res.json({ sent, failed });
  } catch (error) {
    next(error);
  }
});

router.post("/digest", async (req, res, next) => {
  try {
    const supabase = getClient();
    const now = new Date();

    const { data: students, error } = await supabase
      .from("students")
      .select("id, email, last_digest_at")
      .eq("email_digest", true);
    if (error) throw error;

    const waiting = (students || []).filter(
      (s) => !s.last_digest_at || now - new Date(s.last_digest_at) >= DIGEST_GAP_MS
    );

    let sent = 0;
    let failed = 0;
    for (const student of waiting) {
      // Count emails, not people looked at: those with nothing due must not use up the batch.
      if (sent + failed >= BATCH) break;
      const { data: tasks, error: taskError } = await supabase
        .from("tasks")
        .select("title, deadline")
        .eq("student_id", student.id)
        .in("status", OPEN)
        .lte("deadline", new Date(now.getTime() + 7 * 86400000).toISOString())
        .order("deadline", { ascending: true })
        .limit(BATCH);
      if (taskError) throw taskError;
      if (!tasks?.length) continue;

      const claim = supabase.from("students").update({ last_digest_at: now.toISOString() }).eq("id", student.id);
      const { data: claimed, error: claimError } = await (
        student.last_digest_at ? claim.eq("last_digest_at", student.last_digest_at) : claim.is("last_digest_at", null)
      ).select("id");
      if (claimError) throw claimError;
      if (!claimed?.length) continue;

      const line = (t) => `- ${t.title} (${when(t.deadline)})`;
      const overdue = tasks.filter((t) => new Date(t.deadline) < now);
      const upcoming = tasks.filter((t) => new Date(t.deadline) >= now);
      const body = [
        overdue.length ? `Overdue:\n${overdue.map(line).join("\n")}` : "",
        upcoming.length ? `Due in the next 7 days:\n${upcoming.map(line).join("\n")}` : "",
        `Stop these emails: ${unsubscribeUrl(student.id)}`,
      ]
        .filter(Boolean)
        .join("\n\n");

      try {
        await sendEmail(student.email, "Your week in Quill", body);
        sent += 1;
      } catch (err) {
        console.error("Digest email failed:", err.message);
        failed += 1;
        await supabase.from("students").update({ last_digest_at: student.last_digest_at ?? null }).eq("id", student.id);
      }
    }
    res.json({ sent, failed });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
