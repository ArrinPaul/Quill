const { getClient } = require("../services/supabase");

function getDailyLimit() {
  const raw = process.env.AI_DAILY_LIMIT;
  if (raw === undefined || raw === "") return 50;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 50;
}

async function aiQuota(req, res, next) {
  try {
    if (!req.student?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const limit = getDailyLimit();
    const { data: allowed, error } = await getClient().rpc("bump_ai_usage", {
      p_student: req.student.id,
      p_limit: limit,
    });

    if (error) return next(error);

    if (!allowed) {
      return res.status(429).json({ message: "Daily AI limit reached" });
    }

    req.aiQuotaCharged = true;
    return next();
  } catch (err) {
    return next(err);
  }
}

async function refundAiQuota(studentId) {
  if (!studentId) return;
  try {
    const { error } = await getClient().rpc("refund_ai_usage", {
      p_student: studentId,
    });
    if (error) {
      console.error("Failed to refund AI usage:", error.message);
    }
  } catch (err) {
    console.error("Failed to refund AI usage:", err.message);
  }
}

module.exports = {
  aiQuota,
  refundAiQuota,
  getDailyLimit,
};
