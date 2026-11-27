const express = require("express");
const { getClient } = require("../services/supabase");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
  try {
    const { data: attendance, error } = await getClient()
      .from("attendance")
      .select("*")
      .eq("student_id", req.student.id)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    res.json({ attendance });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { subject, total_classes, attended_classes, threshold } = req.body;

    if (!subject || total_classes === undefined || attended_classes === undefined) {
      return res.status(400).json({ message: "Subject, total classes, and attended classes are required" });
    }

    const target = threshold === undefined || threshold === null || threshold === "" ? 75 : Number(threshold);
    const isCount = (n) => Number.isInteger(n) && n >= 0;
    if (!isCount(total_classes) || !isCount(attended_classes) || attended_classes > total_classes) {
      return res.status(400).json({ message: "Class counts must be whole numbers, with attended no greater than total" });
    }
    if (!Number.isFinite(target) || target < 0 || target > 100) {
      return res.status(400).json({ message: "Threshold must be between 0 and 100" });
    }

    const { data: existing } = await getClient()
      .from("attendance")
      .select("id")
      .eq("student_id", req.student.id)
      .eq("subject", subject)
      .single();

    let record;

    if (existing) {
      const { data, error } = await getClient()
        .from("attendance")
        .update({ total_classes, attended_classes, threshold: target, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      record = data;
    } else {
      const { data, error } = await getClient()
        .from("attendance")
        .insert({
          student_id: req.student.id,
          subject,
          total_classes,
          attended_classes,
          threshold: target,
        })
        .select()
        .single();

      if (error) throw error;
      record = data;
    }

    res.json({ attendance: record });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { error } = await getClient()
      .from("attendance")
      .delete()
      .eq("id", req.params.id)
      .eq("student_id", req.student.id);

    if (error) throw error;
    res.json({ message: "Attendance record deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
