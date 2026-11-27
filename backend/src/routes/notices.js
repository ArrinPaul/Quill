const express = require("express");
const { getClient } = require("../services/supabase");
const authMiddleware = require("../middleware/auth");
const { summarizeNotice } = require("../services/groq");

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
  try {
    const { data: notices, error } = await getClient()
      .from("notices")
      .select("*")
      .eq("student_id", req.student.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ notices });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { notice_text, event_title, event_date } = req.body;

    if (!notice_text) {
      return res.status(400).json({ message: "Notice text is required" });
    }

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
    res.json({ notice });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { notice_text, event_title, event_date } = req.body;
    if (typeof notice_text !== "string" || !notice_text.trim()) {
      return res.status(400).json({ message: "Notice text is required" });
    }

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
    res.status(500).json({ message: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { data, error } = await getClient()
      .from("notices")
      .delete()
      .eq("id", req.params.id)
      .eq("student_id", req.student.id)
      .select("id");

    if (error) throw error;
    if (!data.length) return res.status(404).json({ message: "Notice not found" });
    res.json({ message: "Notice deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/broadcast", async (req, res) => {
  res.status(410).json({ message: "Notice broadcast via n8n/Telegram has been removed." });
});

module.exports = router;
