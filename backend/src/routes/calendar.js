const crypto = require("crypto");
const express = require("express");
const authMiddleware = require("../middleware/auth");
const validate = require("../middleware/validate");
const { studentIdParamSchema } = require("../schemas/calendar");
const { getClient } = require("../services/supabase");

const router = express.Router();

// The n8n workflow that called this has been removed; it had no authentication.
router.post("/fan-out", (req, res) => {
  res.status(410).json({ message: "Calendar fan-out via n8n has been removed." });
});

// Calendar apps can't send auth headers, so the feed URL carries a per-student signature.
const feedToken = (studentId, feedVersion) => {
  const version = feedVersion ?? 0;
  return crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(`calendar-feed:${studentId}:${version}`)
    .digest("hex");
};

const feedPath = (studentId, feedVersion) =>
  `/api/calendar/feed/${studentId}?token=${feedToken(studentId, feedVersion)}`;

router.get("/feed-url", authMiddleware, async (req, res, next) => {
  try {
    const supabase = getClient();
    const { data: student, error } = await supabase
      .from("students")
      .select("id, feed_version")
      .eq("id", req.student.id)
      .maybeSingle();

    if (error) throw error;
    if (!student) return res.status(404).json({ message: "Student not found" });

    res.json({ path: feedPath(req.student.id, student.feed_version) });
  } catch (error) {
    next(error);
  }
});

router.post("/feed-reset", authMiddleware, async (req, res, next) => {
  try {
    const supabase = getClient();
    const { data: student, error: fetchError } = await supabase
      .from("students")
      .select("id, feed_version")
      .eq("id", req.student.id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!student) return res.status(404).json({ message: "Student not found" });

    const nextVersion = (student.feed_version ?? 0) + 1;
    const { error: updateError } = await supabase
      .from("students")
      .update({ feed_version: nextVersion })
      .eq("id", req.student.id);

    if (updateError) throw updateError;

    res.json({ path: feedPath(req.student.id, nextVersion) });
  } catch (error) {
    next(error);
  }
});

const escapeIcs = (value) =>
  String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");

function formatIcsDate(dateString) {
  if (!dateString) return null;
  const d = new Date(dateString);
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

// GET /api/calendar/feed/:student_id
// Generates an iCal (.ics) feed that users can subscribe to in Google/Apple Calendar without OAuth
router.get("/feed/:student_id", validate({ params: studentIdParamSchema }), async (req, res, next) => {
  try {
    const { student_id } = req.params;
    const supabase = getClient();
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("id, feed_version")
      .eq("id", student_id)
      .maybeSingle();

    if (studentError) throw studentError;
    if (!student) {
      return res.status(401).send("Invalid calendar feed link");
    }

    const given = Buffer.from(String(req.query.token || ""));
    const expected = Buffer.from(feedToken(student_id, student.feed_version));
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
      return res.status(401).send("Invalid calendar feed link");
    }

    // Fetch personal tasks
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .eq("student_id", student_id);
      
    if (tasksError) throw tasksError;

    // Fetch group events for this student
    const { data: members } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("student_id", student_id);

    let groupEvents = [];
    if (members && members.length > 0) {
      const groupIds = members.map((m) => m.group_id);
      const { data: events } = await supabase
        .from("events")
        .select("*")
        .in("group_id", groupIds);
      if (events) groupEvents = events;
    }

    let icsLines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Quill//Quill Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Quill Deadlines",
      "X-WR-TIMEZONE:UTC",
    ];

    // Add Tasks (exclude cancelled)
    (tasks || [])
      .filter((t) => t.status !== "cancelled")
      .forEach((t) => {
      const dtStart = formatIcsDate(t.deadline);
      const dtEnd = formatIcsDate(new Date(new Date(t.deadline).getTime() + 3600000));
      icsLines.push(
        "BEGIN:VEVENT",
        `UID:task-${t.id}@quill.app`,
        `DTSTAMP:${formatIcsDate(new Date())}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${escapeIcs(`[Task] ${t.title || "Untitled"}`)}`,
        `DESCRIPTION:${escapeIcs(`${t.subject || ""}\n${t.description || ""}`)}`,
        "END:VEVENT"
      );
    });

    // Add Group Events
    (groupEvents || []).forEach((e) => {
      // event_date is YYYY-MM-DD
      const start = e.event_date.replace(/-/g, "");
      // calculate next day for all day event
      const d = new Date(e.event_date);
      d.setDate(d.getDate() + 1);
      const end = d.toISOString().split("T")[0].replace(/-/g, "");
      
      icsLines.push(
        "BEGIN:VEVENT",
        `UID:event-${e.id}@quill.app`,
        `DTSTAMP:${formatIcsDate(new Date())}`,
        `DTSTART;VALUE=DATE:${start}`,
        `DTEND;VALUE=DATE:${end}`,
        `SUMMARY:${escapeIcs(`[Notice] ${e.title || "Class Event"}`)}`,
        `DESCRIPTION:${escapeIcs(`Priority: ${e.priority || "Medium"}\nCategory: ${e.category || "Other"}\n\n${e.raw_message || ""}`)}`,
        "END:VEVENT"
      );
    });

    icsLines.push("END:VCALENDAR");

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="quill-calendar.ics"`);
    res.send(icsLines.join("\r\n"));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
