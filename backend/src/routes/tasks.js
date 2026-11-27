const express = require("express");
const { getClient } = require("../services/supabase");
const authMiddleware = require("../middleware/auth");
const validate = require("../middleware/validate");
const { idParamSchema } = require("../schemas/common");
const { createTaskSchema, updateTaskSchema } = require("../schemas/tasks");
const { logActivity } = require("../services/activity");

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res, next) => {
  try {
    const { data: tasks, error } = await getClient()
      .from("tasks")
      .select("*")
      .eq("student_id", req.student.id)
      .order("deadline", { ascending: true });

    if (error) throw error;
    res.json({ tasks });
  } catch (error) {
    next(error);
  }
});

router.get("/today", async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: tasks, error } = await getClient()
      .from("tasks")
      .select("*")
      .eq("student_id", req.student.id)
      .gte("deadline", today.toISOString())
      .lt("deadline", tomorrow.toISOString())
      .order("deadline", { ascending: true });

    if (error) throw error;
    res.json({ tasks });
  } catch (error) {
    next(error);
  }
});

router.get("/upcoming", async (req, res, next) => {
  try {
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const { data: tasks, error } = await getClient()
      .from("tasks")
      .select("*")
      .eq("student_id", req.student.id)
      .gte("deadline", now.toISOString())
      .lte("deadline", nextWeek.toISOString())
      .order("deadline", { ascending: true });

    if (error) throw error;
    res.json({ tasks });
  } catch (error) {
    next(error);
  }
});

router.post("/", validate({ body: createTaskSchema }), async (req, res, next) => {
  try {
    const { title, subject, description, deadline, reminder_time, add_to_calendar, importance } = req.body;

    const reminder = reminder_time || new Date(new Date(deadline).getTime() - 86400000).toISOString();

    const { data: task, error } = await getClient()
      .from("tasks")
      .insert({
        student_id: req.student.id,
        title,
        subject,
        description,
        deadline,
        reminder_time: reminder,
        add_to_calendar: add_to_calendar !== false,
        importance: importance ?? "normal",
      })
      .select()
      .single();

    if (error) throw error;

    await logActivity(req.student.id, "task_created", task.title, task.id);

    res.json({ task });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", validate({ params: idParamSchema, body: updateTaskSchema }), async (req, res, next) => {
  try {
    const { title, subject, description, deadline, reminder_time, status, importance } = req.body;

    const updatePayload = { title, subject, description, deadline, status };
    if (importance !== undefined) {
      updatePayload.importance = importance;
    }
    if (status !== undefined) {
      const { data: current } = await getClient()
        .from("tasks")
        .select("status")
        .eq("id", req.params.id)
        .eq("student_id", req.student.id)
        .maybeSingle();
      if (status !== "completed") updatePayload.completed_at = null;
      else if (current && current.status !== "completed") updatePayload.completed_at = new Date().toISOString();
    }
    if (reminder_time !== undefined) {
      updatePayload.reminder_time = reminder_time;
    }

    const { data: task, error } = await getClient()
      .from("tasks")
      .update(updatePayload)
      .eq("id", req.params.id)
      .eq("student_id", req.student.id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (status === "completed") {
      await logActivity(req.student.id, "task_completed", task.title, task.id);
    }
    res.json({ task });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    const { data, error } = await getClient()
      .from("tasks")
      .delete()
      .eq("id", req.params.id)
      .eq("student_id", req.student.id)
      .select("id");

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ message: "Task not found" });
    res.json({ message: "Task deleted" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
