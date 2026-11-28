const { getClient } = require("./supabase");

const ROLE_RANK = {
  member: 1,
  admin: 2,
  owner: 3,
};

function createHttpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Ensures studentId is a member of groupId with at least minRole.
 * Non-members always receive 404; only actual members with insufficient role receive 403.
 */
async function requireMember(groupId, studentId, minRole = "member") {
  const requiredRank = ROLE_RANK[minRole];
  if (!requiredRank) {
    throw new Error(`Invalid minRole: ${minRole}`);
  }

  const { data: membership, error } = await getClient()
    .from("study_group_members")
    .select("id, group_id, student_id, role, joined_at")
    .eq("group_id", groupId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) throw error;
  if (!membership) {
    throw createHttpError(404, "Study group not found");
  }

  const actualRank = ROLE_RANK[membership.role] || 0;
  if (actualRank < requiredRank) {
    throw createHttpError(403, "You do not have permission to perform this action");
  }

  return membership;
}

module.exports = {
  ROLE_RANK,
  requireMember,
};
