const express = require("express");
const { getClient } = require("../services/supabase");
const authMiddleware = require("../middleware/auth");
const validate = require("../middleware/validate");
const { idParamSchema } = require("../schemas/common");
const { upsertAttendanceSchema } = require("../schemas/attendance");

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res, next) => {
  try {
    const { data: attendance, error } = await getClient()
      .from("attendance")
      .select("*")
      .eq("student_id", req.student.id)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    res.json({ attendance });
  } catch (error) {
    next(error);
  }
});

router.post("/", validate({ body: upsertAttendanceSchema }), async (req, res, next) => {
  try {
    const { subject, total_classes, attended_classes, threshold } = req.body;

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
        .update({ total_classes, attended_classes, threshold, updated_at: new Date().toISOString() })
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
          threshold,
        })
        .select()
        .single();

      if (error) throw error;
      record = data;
    }

    res.json({ attendance: record });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    const { data, error } = await getClient()
      .from("attendance")
      .delete()
      .eq("id", req.params.id)
      .eq("student_id", req.student.id)
      .select("id");

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ message: "Attendance record not found" });
    res.json({ message: "Attendance record deleted" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
