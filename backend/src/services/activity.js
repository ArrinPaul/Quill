const { getClient } = require("./supabase");

const COMPLETION_TYPES = new Set(["task_completed", "quiz_completed"]);

/**
 * Record an activity event for a student. Never throws so a logging
 * failure never breaks the primary user action.
 */
async function logActivity(studentId, type, title, entityId = null) {
  try {
    if (!studentId || !type || !title) return;

    const supabase = getClient();

    if (COMPLETION_TYPES.has(type) && entityId) {
      const { data: existing, error: selectError } = await supabase
        .from("activity_log")
        .select("id")
        .eq("student_id", studentId)
        .eq("type", type)
        .eq("entity_id", entityId)
        .limit(1)
        .maybeSingle();

      if (selectError) {
        console.error("Failed to check existing activity:", selectError);
        return;
      }
      if (existing) return;
    }

    const { error: insertError } = await supabase.from("activity_log").insert({
      student_id: studentId,
      type,
      title: String(title).slice(0, 200),
      entity_id: entityId || null,
    });

    if (insertError) {
      console.error("Failed to log activity:", insertError);
    }
  } catch (err) {
    console.error("Unexpected error in logActivity:", err);
  }
}

module.exports = {
  logActivity,
  COMPLETION_TYPES,
};
