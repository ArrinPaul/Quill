const { getClient } = require("./supabase");

/**
 * Record an audit log entry for a study group. Never throws so a logging
 * failure never breaks the primary user action.
 */
async function logAudit(groupId, actorId, action, target = null) {
  try {
    if (!groupId || !action) return;

    const supabase = getClient();
    const { error } = await supabase.from("audit_log").insert({
      group_id: groupId,
      actor_id: actorId || null,
      action: String(action).slice(0, 100),
      target: target !== null && target !== undefined ? String(target).slice(0, 500) : null,
    });

    if (error) {
      console.error("Failed to log audit event:", error);
    }
  } catch (err) {
    console.error("Unexpected error in logAudit:", err);
  }
}

module.exports = {
  logAudit,
};
