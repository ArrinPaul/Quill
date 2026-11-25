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

router.post("/broadcast", async (req, res) => {
  res.status(410).json({ message: "Notice broadcast via n8n/Telegram has been removed." });
});

module.exports = router;
