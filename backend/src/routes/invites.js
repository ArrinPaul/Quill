const crypto = require("crypto");
const express = require("express");
const { getClient } = require("../services/supabase");
const authMiddleware = require("../middleware/auth");
const { inviteLimiter } = require("../middleware/rateLimit");

const router = express.Router();
router.use(inviteLimiter);

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const INVITE_CODE_RE = /^[A-Z2-7]{16}$/;
const INVITE_NOT_FOUND_MSG = "Invite not found or expired";
const DEV_STUDENT_ID = "00000000-0000-0000-0000-000000000000";

function generateInviteCode() {
  const bytes = crypto.randomBytes(16);
  let code = "";
  for (let i = 0; i < 16; i += 1) {
    code += BASE32_ALPHABET[bytes[i] & 31];
  }
  return code;
}

function normalizeInviteCode(raw) {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toUpperCase();
  return INVITE_CODE_RE.test(normalized) ? normalized : null;
}

function hashInviteCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function isInviteActive(invite) {
  if (!invite) return false;
  if (invite.revoked_at !== null && invite.revoked_at !== undefined) return false;
  if (new Date(invite.expires_at).getTime() <= Date.now()) return false;
  if (invite.max_uses !== null && invite.max_uses !== undefined && invite.uses >= invite.max_uses) {
    return false;
  }
  return true;
}

router.get("/:code", async (req, res, next) => {
  try {
    const code = normalizeInviteCode(req.params.code);
    if (!code) {
      return res.status(404).json({ message: INVITE_NOT_FOUND_MSG });
    }

    const supabase = getClient();
    const codeHash = hashInviteCode(code);

    const { data: invite, error: inviteError } = await supabase
      .from("study_group_invites")
      .select("id, group_id, expires_at, max_uses, uses, revoked_at")
      .eq("code_hash", codeHash)
      .maybeSingle();

    if (inviteError) throw inviteError;
    if (!isInviteActive(invite)) {
      return res.status(404).json({ message: INVITE_NOT_FOUND_MSG });
    }

    const { data: group, error: groupError } = await supabase
      .from("study_groups")
      .select("id, name")
      .eq("id", invite.group_id)
      .maybeSingle();

    if (groupError) throw groupError;
    if (!group) {
      return res.status(404).json({ message: INVITE_NOT_FOUND_MSG });
    }

    const { data: members, error: membersError } = await supabase
      .from("study_group_members")
      .select("id")
      .eq("group_id", group.id);

    if (membersError) throw membersError;

    res.json({
      group: {
        name: group.name,
        member_count: (members || []).length,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:code/accept", authMiddleware, async (req, res, next) => {
  try {
    const supabase = getClient();
    const studentId = req.student.id;

    if (studentId !== DEV_STUDENT_ID) {
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("id, email_verified_at")
        .eq("id", studentId)
        .maybeSingle();

      if (studentError) throw studentError;
      if (!student) {
        return res.status(401).json({ message: "Account no longer exists" });
      }
      if (!student.email_verified_at) {
        return res.status(403).json({ message: "Please verify your email before joining a study group." });
      }
    }

    const code = normalizeInviteCode(req.params.code);
    if (!code) {
      return res.status(404).json({ message: INVITE_NOT_FOUND_MSG });
    }

    const codeHash = hashInviteCode(code);
    const { data, error } = await supabase.rpc("accept_study_group_invite", {
      p_code_hash: codeHash,
      p_student: studentId,
    });

    if (error) throw error;
    if (!data || data.status === "not_found") {
      return res.status(404).json({ message: INVITE_NOT_FOUND_MSG });
    }
    if (data.status === "banned") {
      return res.status(403).json({ message: "You are banned from this study group." });
    }
    if (data.status === "full") {
      return res.status(409).json({ message: "This study group has reached its 75-member limit." });
    }

    res.json({
      group_id: data.group_id,
      status: data.status,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
module.exports.generateInviteCode = generateInviteCode;
module.exports.hashInviteCode = hashInviteCode;
