const express = require("express");
const { getClient } = require("../services/supabase");
const authMiddleware = require("../middleware/auth");
const validate = require("../middleware/validate");
const { idParamSchema } = require("../schemas/common");
const { noticeBodySchema } = require("../schemas/notices");
const { summarizeNotice } = require("../services/groq");
const { logActivity } = require("../services/activity");

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res, next) => {
  try {
    const { data: notices, error } = await getClient()
      .from("notices")
      .select("*")
      .eq("student_id", req.student.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ notices });
  } catch (error) {
    next(error);
  }
});

router.post("/", validate({ body: noticeBodySchema }), async (req, res, next) => {
  try {
    const { notice_text, event_title, event_date } = req.body;

    const ai_summary = await summarizeNotice(notice_text);

    const { data: notice, error } = await getClient()
      .from("notices")
      .insert({
        student_id: req.student.id,
        notice_text,
        ai_summary,
        event_title,
        event_date,
      })
      .select()
      .single();

    if (error) throw error;
    const activityTitle =
      (notice.event_title && notice.event_title.trim()) || notice.notice_text.slice(0, 80);
    await logActivity(req.student.id, "notice_added", activityTitle, notice.id);
    res.json({ notice });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", validate({ params: idParamSchema, body: noticeBodySchema }), async (req, res, next) => {
  try {
    const { notice_text, event_title, event_date } = req.body;

    const { data: existing } = await getClient()
      .from("notices")
      .select("notice_text, ai_summary")
      .eq("id", req.params.id)
      .eq("student_id", req.student.id)
      .maybeSingle();
    if (!existing) return res.status(404).json({ message: "Notice not found" });

    // Re-summarize only when the text actually changed
    const ai_summary =
      existing.notice_text === notice_text ? existing.ai_summary : await summarizeNotice(notice_text);

    const { data: notice, error } = await getClient()
      .from("notices")
      .update({ notice_text, ai_summary, event_title: event_title || null, event_date: event_date || null })
      .eq("id", req.params.id)
      .eq("student_id", req.student.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ notice });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    const { data, error } = await getClient()
      .from("notices")
      .delete()
      .eq("id", req.params.id)
      .eq("student_id", req.student.id)
      .select("id");

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ message: "Notice not found" });
    res.json({ message: "Notice deleted" });
  } catch (error) {
    next(error);
  }
});

router.post("/broadcast", async (req, res) => {
  res.status(410).json({ message: "Notice broadcast via n8n/Telegram has been removed." });
});

module.exports = router;
