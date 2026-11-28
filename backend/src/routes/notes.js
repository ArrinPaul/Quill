const express = require("express");
const { getClient } = require("../services/supabase");
const authMiddleware = require("../middleware/auth");
const validate = require("../middleware/validate");
const { aiLimiter } = require("../middleware/rateLimit");
const { aiQuota, refundAiQuota } = require("../middleware/aiQuota");
const { idParamSchema } = require("../schemas/common");
const { createNoteSchema, updateNoteSchema, noteAiSchema } = require("../schemas/notes");
const { runNoteAi } = require("../services/groq");

const router = express.Router();

router.use(authMiddleware);

async function refundIfCharged(req) {
  if (req.aiQuotaCharged && req.student?.id) {
    req.aiQuotaCharged = false;
    await refundAiQuota(req.student.id);
  }
}

// List notes without content
router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await getClient()
      .from("notes")
      .select("id, title, updated_at, created_at, version")
      .eq("student_id", req.student.id)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    res.json({ notes: data || [] });
  } catch (err) {
    next(err);
  }
});

// Get a single note with content
router.get("/:id", validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    const { data: note, error } = await getClient()
      .from("notes")
      .select("*")
      .eq("id", req.params.id)
      .eq("student_id", req.student.id)
      .maybeSingle();

    if (error) throw error;
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    res.json({ note });
  } catch (err) {
    next(err);
  }
});

// Create a new note
router.post("/", validate({ body: createNoteSchema }), async (req, res, next) => {
  try {
    const now = new Date().toISOString();
    const title = req.body.title || "Untitled";
    const content = req.body.content ?? "";

    const { data: note, error } = await getClient()
      .from("notes")
      .insert({
        student_id: req.student.id,
        title,
        content,
        version: 1,
        updated_at: now,
      })
      .select("*")
      .single();

    if (error) throw error;
    res.status(201).json({ note });
  } catch (err) {
    next(err);
  }
});

// Update a note with optimistic concurrency check
router.put("/:id", validate({ params: idParamSchema, body: updateNoteSchema }), async (req, res, next) => {
  try {
    const { data: existing, error: fetchError } = await getClient()
      .from("notes")
      .select("*")
      .eq("id", req.params.id)
      .eq("student_id", req.student.id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) {
      return res.status(404).json({ message: "Note not found" });
    }

    if (!req.body.force && existing.version !== req.body.version) {
      return res.status(409).json({
        message: "Conflict: Note was updated elsewhere. Reload or overwrite to continue.",
        note: existing,
      });
    }

    const nextTitle = req.body.title !== undefined ? req.body.title || "Untitled" : existing.title;
    const nextVersion = existing.version + 1;
    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await getClient()
      .from("notes")
      .update({
        title: nextTitle,
        content: req.body.content,
        version: nextVersion,
        updated_at: now,
      })
      .eq("id", req.params.id)
      .eq("student_id", req.student.id)
      .eq("version", existing.version)
      .select("*")
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updated) {
      return res.status(409).json({
        message: "Conflict: Note was updated elsewhere. Reload or overwrite to continue.",
      });
    }

    res.json({ note: updated });
  } catch (err) {
    next(err);
  }
});

// Delete a note
router.delete("/:id", validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    const { data, error } = await getClient()
      .from("notes")
      .delete()
      .eq("id", req.params.id)
      .eq("student_id", req.student.id)
      .select("id");

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ message: "Note not found" });
    }
    res.json({ message: "Note deleted successfully" });
  } catch (err) {
    next(err);
  }
});

// AI preview actions on a note (does not modify the note in DB)
router.post(
  "/:id/ai",
  aiLimiter,
  validate({ params: idParamSchema, body: noteAiSchema }),
  aiQuota,
  async (req, res, next) => {
    try {
      const { data: note, error } = await getClient()
        .from("notes")
        .select("id, title, content")
        .eq("id", req.params.id)
        .eq("student_id", req.student.id)
        .maybeSingle();

      if (error) throw error;
      if (!note) {
        await refundIfCharged(req);
        return res.status(404).json({ message: "Note not found" });
      }

      if (!note.content || !note.content.trim()) {
        await refundIfCharged(req);
        return res.status(400).json({ message: "content: Add some note content before running AI" });
      }

      const preview = await runNoteAi(req.body.action, note.title, note.content);
      res.json(preview);
    } catch (err) {
      next(err);
    }
  }
);

router.use(async (err, req, res, next) => {
  await refundIfCharged(req);
  next(err);
});

module.exports = router;
