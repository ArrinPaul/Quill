const express = require("express");
const { getClient } = require("../services/supabase");
const authMiddleware = require("../middleware/auth");
const validate = require("../middleware/validate");
const { idParamSchema } = require("../schemas/common");
const { createWhiteboardSchema, updateWhiteboardSchema } = require("../schemas/whiteboards");
const { logActivity } = require("../services/activity");

const router = express.Router();
router.use(authMiddleware);

// Get all whiteboards for the current student
router.get("/", async (req, res, next) => {
  try {
    const { data: whiteboards, error } = await getClient()
      .from("whiteboards")
      .select("*")
      .eq("student_id", req.student.id)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    res.json({ whiteboards });
  } catch (error) {
    next(error);
  }
});

// Get a single whiteboard
router.get("/:id", validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    const { data: whiteboard, error } = await getClient()
      .from("whiteboards")
      .select("*")
      .eq("id", req.params.id)
      .eq("student_id", req.student.id)
      .maybeSingle();

    if (error) throw error;
    if (!whiteboard) {
      return res.status(404).json({ message: "Whiteboard not found" });
    }
    res.json({ whiteboard });
  } catch (error) {
    next(error);
  }
});

// Create a new whiteboard
router.post("/", validate({ body: createWhiteboardSchema }), async (req, res, next) => {
  try {
    const { title, data, thumbnail } = req.body;
    const { data: whiteboard, error } = await getClient()
      .from("whiteboards")
      .insert({
        student_id: req.student.id,
        title: title || "Untitled Whiteboard",
        data: data || {},
        thumbnail: thumbnail || null,
      })
      .select()
      .single();

    if (error) throw error;
    await logActivity(req.student.id, "board_created", whiteboard.title, whiteboard.id);
    res.json({ whiteboard });
  } catch (error) {
    next(error);
  }
});

// Update a whiteboard (save data, rename title, etc.)
router.put("/:id", validate({ params: idParamSchema, body: updateWhiteboardSchema }), async (req, res, next) => {
  try {
    const { title, data, thumbnail } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (data !== undefined) updateData.data = data;
    if (thumbnail !== undefined) updateData.thumbnail = thumbnail;
    updateData.updated_at = new Date().toISOString();

    const { data: whiteboard, error } = await getClient()
      .from("whiteboards")
      .update(updateData)
      .eq("id", req.params.id)
      .eq("student_id", req.student.id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!whiteboard) {
      return res.status(404).json({ message: "Whiteboard not found" });
    }
    res.json({ whiteboard });
  } catch (error) {
    next(error);
  }
});

// Delete a whiteboard
router.delete("/:id", validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    const { data, error } = await getClient()
      .from("whiteboards")
      .delete()
      .eq("id", req.params.id)
      .eq("student_id", req.student.id)
      .select("id");

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ message: "Whiteboard not found" });
    }
    res.json({ message: "Whiteboard deleted successfully" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
