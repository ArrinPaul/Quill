const crypto = require("crypto");
const express = require("express");
const { getClient } = require("../services/supabase");
const authMiddleware = require("../middleware/auth");
const validate = require("../middleware/validate");
const { requireMember } = require("../services/access");
const {
  idParamSchema,
  memberParamSchema,
  createGroupSchema,
  updateGroupSchema,
  deleteGroupSchema,
  updateMemberRoleSchema,
  transferOwnershipSchema,
} = require("../schemas/groups");
const { inviteParamSchema, createInviteSchema } = require("../schemas/invites");
const { generateInviteCode, hashInviteCode } = require("./invites");

const router = express.Router();
router.use(authMiddleware);

const MAX_OWNED_GROUPS = 20;
const DEV_STUDENT_ID = "00000000-0000-0000-0000-000000000000";

function newRealtimeKey() {
  return crypto.randomBytes(24).toString("hex");
}

router.get("/", async (req, res, next) => {
  try {
    const supabase = getClient();
    const { data: memberships, error: memError } = await supabase
      .from("study_group_members")
      .select("group_id, role, joined_at")
      .eq("student_id", req.student.id);

    if (memError) throw memError;
    if (!memberships || memberships.length === 0) {
      return res.json({ groups: [] });
    }

    const groupIds = memberships.map((m) => m.group_id);
    const roleByGroup = new Map(memberships.map((m) => [m.group_id, m.role]));

    const { data: groups, error: groupError } = await supabase
      .from("study_groups")
      .select("id, name, description, owner_id, created_at")
      .in("id", groupIds)
      .order("created_at", { ascending: false });

    if (groupError) throw groupError;

    const { data: allMembers, error: countError } = await supabase
      .from("study_group_members")
      .select("group_id")
      .in("group_id", groupIds);

    if (countError) throw countError;

    const countByGroup = new Map();
    for (const row of allMembers || []) {
      countByGroup.set(row.group_id, (countByGroup.get(row.group_id) || 0) + 1);
    }

    const result = (groups || []).map((g) => ({
      ...g,
      role: roleByGroup.get(g.id),
      member_count: countByGroup.get(g.id) || 0,
    }));

    res.json({ groups: result });
  } catch (error) {
    next(error);
  }
});

router.post("/", validate({ body: createGroupSchema }), async (req, res, next) => {
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
        return res.status(403).json({ message: "Please verify your email before creating a study group." });
      }
    }

    const { data: owned, error: ownedError } = await supabase
      .from("study_groups")
      .select("id")
      .eq("owner_id", studentId);

    if (ownedError) throw ownedError;
    if ((owned || []).length >= MAX_OWNED_GROUPS) {
      return res.status(400).json({ message: `You can own at most ${MAX_OWNED_GROUPS} study groups.` });
    }

    const { name, description } = req.body;
    const { data: group, error: insertError } = await supabase
      .from("study_groups")
      .insert({
        name,
        description: description ?? null,
        owner_id: studentId,
        realtime_key: newRealtimeKey(),
      })
      .select("id, name, description, owner_id, realtime_key, created_at")
      .single();

    if (insertError) throw insertError;

    const { error: memberError } = await supabase
      .from("study_group_members")
      .insert({
        group_id: group.id,
        student_id: studentId,
        role: "owner",
      });

    if (memberError) {
      await supabase.from("study_groups").delete().eq("id", group.id);
      throw memberError;
    }

    res.status(201).json({
      group: {
        ...group,
        role: "owner",
        member_count: 1,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    const membership = await requireMember(req.params.id, req.student.id, "member");
    const supabase = getClient();

    const { data: group, error: groupError } = await supabase
      .from("study_groups")
      .select("id, name, description, owner_id, realtime_key, created_at")
      .eq("id", req.params.id)
      .single();

    if (groupError) throw groupError;

    const { data: members, error: membersError } = await supabase
      .from("study_group_members")
      .select("id")
      .eq("group_id", req.params.id);

    if (membersError) throw membersError;

    res.json({
      group: {
        ...group,
        role: membership.role,
        member_count: (members || []).length,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", validate({ params: idParamSchema, body: updateGroupSchema }), async (req, res, next) => {
  try {
    await requireMember(req.params.id, req.student.id, "admin");
    const supabase = getClient();

    const patch = {};
    if (req.body.name !== undefined) patch.name = req.body.name;
    if (req.body.description !== undefined) patch.description = req.body.description;

    const { data: group, error } = await supabase
      .from("study_groups")
      .update(patch)
      .eq("id", req.params.id)
      .select("id, name, description, owner_id, realtime_key, created_at")
      .single();

    if (error) throw error;
    res.json({ group });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", validate({ params: idParamSchema, body: deleteGroupSchema }), async (req, res, next) => {
  try {
    await requireMember(req.params.id, req.student.id, "owner");
    const supabase = getClient();

    const { data: group, error: fetchError } = await supabase
      .from("study_groups")
      .select("id, name")
      .eq("id", req.params.id)
      .single();

    if (fetchError) throw fetchError;
    if (req.body.confirmName !== group.name) {
      return res.status(400).json({ message: "Group name confirmation does not match." });
    }

    const { error: deleteError } = await supabase
      .from("study_groups")
      .delete()
      .eq("id", req.params.id);

    if (deleteError) throw deleteError;
    res.json({ message: "Study group deleted" });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/members", validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    await requireMember(req.params.id, req.student.id, "member");
    const supabase = getClient();

    const { data: memberships, error: memError } = await supabase
      .from("study_group_members")
      .select("student_id, role, joined_at")
      .eq("group_id", req.params.id)
      .order("joined_at", { ascending: true });

    if (memError) throw memError;
    if (!memberships || memberships.length === 0) {
      return res.json({ members: [] });
    }

    const studentIds = memberships.map((m) => m.student_id);
    const { data: students, error: studentError } = await supabase
      .from("students")
      .select("id, name, branch, year")
      .in("id", studentIds);

    if (studentError) throw studentError;

    const studentById = new Map((students || []).map((s) => [s.id, s]));
    const members = memberships
      .map((m) => {
        const s = studentById.get(m.student_id);
        if (!s) return null;
        return {
          id: s.id,
          name: s.name,
          branch: s.branch,
          year: s.year,
          role: m.role,
          joined_at: m.joined_at,
        };
      })
      .filter(Boolean);

    res.json({ members });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/:id/members/:sid",
  validate({ params: memberParamSchema, body: updateMemberRoleSchema }),
  async (req, res, next) => {
    try {
      await requireMember(req.params.id, req.student.id, "owner");
      const supabase = getClient();

      if (req.params.sid === req.student.id) {
        return res.status(400).json({ message: "Owner cannot change their own role. Transfer ownership instead." });
      }

      const { data: target, error: targetError } = await supabase
        .from("study_group_members")
        .select("id, role")
        .eq("group_id", req.params.id)
        .eq("student_id", req.params.sid)
        .maybeSingle();

      if (targetError) throw targetError;
      if (!target) {
        return res.status(404).json({ message: "Member not found" });
      }
      if (target.role === "owner") {
        return res.status(400).json({ message: "Cannot change owner role" });
      }

      const { data: member, error: updateError } = await supabase
        .from("study_group_members")
        .update({ role: req.body.role })
        .eq("group_id", req.params.id)
        .eq("student_id", req.params.sid)
        .select("id, group_id, student_id, role, joined_at")
        .single();

      if (updateError) throw updateError;
      res.json({ member });
    } catch (error) {
      next(error);
    }
  }
);

router.delete("/:id/members/:sid", validate({ params: memberParamSchema }), async (req, res, next) => {
  try {
    const actor = await requireMember(req.params.id, req.student.id, "member");
    const isSelf = req.params.sid === req.student.id;

    if (!isSelf && actor.role === "member") {
      return res.status(403).json({ message: "You do not have permission to remove other members." });
    }

    const supabase = getClient();
    const { data: target, error: targetError } = await supabase
      .from("study_group_members")
      .select("id, role")
      .eq("group_id", req.params.id)
      .eq("student_id", req.params.sid)
      .maybeSingle();

    if (targetError) throw targetError;
    if (!target) {
      return res.status(404).json({ message: "Member not found" });
    }

    if (target.role === "owner") {
      return res.status(400).json({
        message: isSelf
          ? "Owner cannot leave the group without transferring ownership."
          : "Cannot remove the group owner.",
      });
    }

    if (!isSelf && actor.role === "admin" && target.role === "admin") {
      return res.status(403).json({ message: "Admins cannot remove other admins." });
    }

    const { error: deleteError } = await supabase
      .from("study_group_members")
      .delete()
      .eq("group_id", req.params.id)
      .eq("student_id", req.params.sid);

    if (deleteError) throw deleteError;

    const { error: rotateError } = await supabase
      .from("study_groups")
      .update({ realtime_key: newRealtimeKey() })
      .eq("id", req.params.id);

    if (rotateError) throw rotateError;

    res.json({ message: isSelf ? "Left study group" : "Member removed" });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/transfer", validate({ params: idParamSchema, body: transferOwnershipSchema }), async (req, res, next) => {
  try {
    await requireMember(req.params.id, req.student.id, "owner");
    const { studentId } = req.body;

    if (studentId === req.student.id) {
      return res.status(400).json({ message: "You are already the owner of this group." });
    }

    const supabase = getClient();
    const { data: target, error: targetError } = await supabase
      .from("study_group_members")
      .select("id, role")
      .eq("group_id", req.params.id)
      .eq("student_id", studentId)
      .maybeSingle();

    if (targetError) throw targetError;
    if (!target) {
      return res.status(404).json({ message: "Target student is not a member of this group." });
    }

    // Demote current owner before promoting the new owner to satisfy idx_study_group_one_owner
    const { error: demoteError } = await supabase
      .from("study_group_members")
      .update({ role: "admin" })
      .eq("group_id", req.params.id)
      .eq("student_id", req.student.id);

    if (demoteError) throw demoteError;

    const { error: promoteError } = await supabase
      .from("study_group_members")
      .update({ role: "owner" })
      .eq("group_id", req.params.id)
      .eq("student_id", studentId);

    if (promoteError) throw promoteError;

    const { error: groupError } = await supabase
      .from("study_groups")
      .update({ owner_id: studentId })
      .eq("id", req.params.id);

    if (groupError) throw groupError;

    res.json({ message: "Ownership transferred", ownerId: studentId });
  } catch (error) {
    next(error);
  }
});

const INVITE_PUBLIC_FIELDS =
  "id, group_id, created_by, expires_at, max_uses, uses, revoked_at, created_at";

router.post(
  "/:id/invites",
  validate({ params: idParamSchema, body: createInviteSchema }),
  async (req, res, next) => {
    try {
      await requireMember(req.params.id, req.student.id, "admin");
      const supabase = getClient();

      const code = generateInviteCode();
      const codeHash = hashInviteCode(code);
      const expiresAt = new Date(
        Date.now() + req.body.expiresInDays * 24 * 60 * 60 * 1000
      ).toISOString();

      const { data: invite, error } = await supabase
        .from("study_group_invites")
        .insert({
          group_id: req.params.id,
          code_hash: codeHash,
          created_by: req.student.id,
          expires_at: expiresAt,
          max_uses: req.body.maxUses,
        })
        .select(INVITE_PUBLIC_FIELDS)
        .single();

      if (error) throw error;
      res.status(201).json({ invite, code });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/:id/invites", validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    await requireMember(req.params.id, req.student.id, "admin");
    const supabase = getClient();

    const { data: invites, error } = await supabase
      .from("study_group_invites")
      .select(INVITE_PUBLIC_FIELDS)
      .eq("group_id", req.params.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ invites: invites || [] });
  } catch (error) {
    next(error);
  }
});

router.delete(
  "/:id/invites/:inviteId",
  validate({ params: inviteParamSchema }),
  async (req, res, next) => {
    try {
      await requireMember(req.params.id, req.student.id, "admin");
      const supabase = getClient();

      const { data: invite, error } = await supabase
        .from("study_group_invites")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", req.params.inviteId)
        .eq("group_id", req.params.id)
        .select(INVITE_PUBLIC_FIELDS)
        .maybeSingle();

      if (error) throw error;
      if (!invite) {
        return res.status(404).json({ message: "Invite not found" });
      }
      res.json({ invite });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
