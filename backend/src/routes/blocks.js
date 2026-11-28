const express = require("express");
const { getClient } = require("../services/supabase");
const authMiddleware = require("../middleware/auth");
const validate = require("../middleware/validate");
const { blockStudentSchema, blockParamSchema } = require("../schemas/safety");

const router = express.Router();
router.use(authMiddleware);

router.get("/", async (req, res, next) => {
  try {
    const supabase = getClient();
    const { data: rows, error } = await supabase
      .from("blocks")
      .select("id, blocked_id, created_at")
      .eq("blocker_id", req.student.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!rows || rows.length === 0) {
      return res.json({ blocks: [] });
    }

    const blockedIds = rows.map((r) => r.blocked_id);
    const { data: students, error: studentError } = await supabase
      .from("students")
      .select("id, name, branch, year")
      .in("id", blockedIds);

    if (studentError) throw studentError;

    const byId = new Map((students || []).map((s) => [s.id, s]));
    const blocks = rows.map((r) => {
      const s = byId.get(r.blocked_id);
      return {
        id: r.id,
        blocked_id: r.blocked_id,
        created_at: r.created_at,
        student: s
          ? { id: s.id, name: s.name, branch: s.branch, year: s.year }
          : null,
      };
    });

    res.json({ blocks });
  } catch (error) {
    next(error);
  }
});

router.post("/", validate({ body: blockStudentSchema }), async (req, res, next) => {
  try {
    const { studentId } = req.body;
    if (studentId === req.student.id) {
      return res.status(400).json({ message: "You cannot block yourself." });
    }

    const supabase = getClient();
    const { data: target, error: targetError } = await supabase
      .from("students")
      .select("id, name, branch, year")
      .eq("id", studentId)
      .maybeSingle();

    if (targetError) throw targetError;
    if (!target) {
      return res.status(404).json({ message: "Student not found" });
    }

    const { data: existing, error: existingError } = await supabase
      .from("blocks")
      .select("id, blocked_id, created_at")
      .eq("blocker_id", req.student.id)
      .eq("blocked_id", studentId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      return res.json({
        block: {
          ...existing,
          student: { id: target.id, name: target.name, branch: target.branch, year: target.year },
        },
      });
    }

    const { data: block, error: insertError } = await supabase
      .from("blocks")
      .insert({
        blocker_id: req.student.id,
        blocked_id: studentId,
      })
      .select("id, blocked_id, created_at")
      .single();

    if (insertError) throw insertError;

    res.status(201).json({
      block: {
        ...block,
        student: { id: target.id, name: target.name, branch: target.branch, year: target.year },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:studentId", validate({ params: blockParamSchema }), async (req, res, next) => {
  try {
    const supabase = getClient();
    const { data, error } = await supabase
      .from("blocks")
      .delete()
      .eq("blocker_id", req.student.id)
      .eq("blocked_id", req.params.studentId)
      .select("id, blocked_id");

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ message: "Block not found" });
    }

    res.json({ message: "User unblocked" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
