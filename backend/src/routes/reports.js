const express = require("express");
const { getClient } = require("../services/supabase");
const authMiddleware = require("../middleware/auth");
const validate = require("../middleware/validate");
const { z } = require("../schemas/common");

const router = express.Router();
router.use(authMiddleware);

const querySchema = z.object({
  range: z.enum(["7", "30", "90"]).default("30"),
  // minutes as returned by Date#getTimezoneOffset, so weeks match the student's calendar
  tzOffset: z.coerce.number().int().min(-840).max(840).default(0),
});

/** Monday of the student's local week, as YYYY-MM-DD. */
function weekOf(iso, tzOffset) {
  const local = new Date(new Date(iso).getTime() - tzOffset * 60000);
  local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
  return local.toISOString().slice(0, 10);
}

function weekKeys(from, to, tzOffset) {
  const keys = new Set();
  for (let t = from.getTime(); t <= to.getTime(); t += 86400000) keys.add(weekOf(new Date(t).toISOString(), tzOffset));
  keys.add(weekOf(to.toISOString(), tzOffset));
  return [...keys];
}

router.get("/me", validate({ query: querySchema }), async (req, res, next) => {
  try {
    const supabase = getClient();
    const { range, tzOffset } = req.query;
    const days = Number(range);
    const now = new Date();
    const from = new Date(now.getTime() - days * 86400000);
    const since = from.toISOString();
    const mine = (table, columns) => supabase.from(table).select(columns).eq("student_id", req.student.id);

    const results = await Promise.all([
      mine("tasks", "completed_at, deadline").eq("status", "completed").gte("completed_at", since),
      mine("quizzes", "title, score, created_at").gte("created_at", since).order("created_at", { ascending: true }),
      mine("attendance", "subject, attended_classes, total_classes, threshold"),
      mine("focus_sessions", "minutes, created_at").gte("created_at", since),
    ]);
    const failed = results.find((r) => r.error);
    if (failed) throw failed.error;
    const [tasks, quizzes, attendance, focus] = results.map((r) => r.data || []);

    const weeks = weekKeys(from, now, tzOffset);
    const perWeek = (rows, dateKey, amount) => {
      const totals = new Map(weeks.map((w) => [w, 0]));
      for (const row of rows) {
        const week = weekOf(row[dateKey], tzOffset);
        totals.set(week, (totals.get(week) || 0) + amount(row));
      }
      return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([week, value]) => ({ week, value }));
    };

    const onTime = tasks.filter((t) => new Date(t.completed_at) <= new Date(t.deadline)).length;

    res.json({
      range: days,
      tasks: {
        completed: tasks.length,
        onTimeRate: tasks.length ? Math.round((onTime / tasks.length) * 100) : null,
        perWeek: perWeek(tasks, "completed_at", () => 1),
      },
      quizzes: quizzes
        .filter((q) => q.score !== null && q.score !== undefined)
        .map((q) => ({ title: q.title, score: q.score, date: q.created_at })),
      attendance: attendance
        .filter((a) => a.total_classes > 0)
        .map((a) => ({
          subject: a.subject,
          percentage: Math.round((a.attended_classes / a.total_classes) * 100),
          threshold: a.threshold,
        })),
      focus: {
        totalMinutes: focus.reduce((sum, f) => sum + f.minutes, 0),
        perWeek: perWeek(focus, "created_at", (f) => f.minutes),
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
