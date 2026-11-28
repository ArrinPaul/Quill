const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { startTestServer } = require("./helpers/testApp");

function verifyStudent(db, studentId) {
  const row = db.tables.students.find((s) => s.id === studentId);
  if (row) row.email_verified_at = new Date().toISOString();
}

function addMember(db, groupId, studentId, role = "member", joinedAt = new Date().toISOString()) {
  db.tables.study_group_members.push({
    id: crypto.randomUUID(),
    group_id: groupId,
    student_id: studentId,
    role,
    joined_at: joinedAt,
  });
}

describe("C3 Study groups, roles, access control, and account deletion", () => {
  let srv;

  beforeEach(async () => {
    srv = await startTestServer();
  });

  afterEach(async () => {
    await srv.close();
  });

  it("rejects unauthenticated requests with 401 across all 9 routes", async () => {
    const gid = crypto.randomUUID();
    const sid = crypto.randomUUID();
    const checks = [
      ["GET", "/api/groups"],
      ["POST", "/api/groups", { name: "Algorithms" }],
      ["GET", `/api/groups/${gid}`],
      ["PATCH", `/api/groups/${gid}`, { name: "New Name" }],
      ["DELETE", `/api/groups/${gid}`, { confirmName: "Algorithms" }],
      ["GET", `/api/groups/${gid}/members`],
      ["PATCH", `/api/groups/${gid}/members/${sid}`, { role: "admin" }],
      ["DELETE", `/api/groups/${gid}/members/${sid}`],
      ["POST", `/api/groups/${gid}/transfer`, { studentId: sid }],
    ];

    for (const [method, path, body] of checks) {
      const res = await srv.request(method, path, { body });
      assert.equal(res.status, 401, `${method} ${path} should return 401`);
    }
  });

  it("returns 404 for invalid UUID route params", async () => {
    const owner = await srv.registerStudent();
    const validId = crypto.randomUUID();

    const r1 = await srv.request("GET", "/api/groups/not-a-uuid", { token: owner.token });
    assert.equal(r1.status, 404);

    const r2 = await srv.request("PATCH", `/api/groups/${validId}/members/not-a-uuid`, {
      token: owner.token,
      body: { role: "admin" },
    });
    assert.equal(r2.status, 404);
  });

  it("requires verified email to create a group and enforces max 20 owned groups", async () => {
    const user = await srv.registerStudent({ email: "unverified@example.com" });

    const unverifiedRes = await srv.request("POST", "/api/groups", {
      token: user.token,
      body: { name: "Study Squad", description: "CS101 prep" },
    });
    assert.equal(unverifiedRes.status, 403);

    verifyStudent(srv.db, user.student.id);

    const badName = await srv.request("POST", "/api/groups", {
      token: user.token,
      body: { name: "ab" },
    });
    assert.equal(badName.status, 400);

    for (let i = 1; i <= 20; i += 1) {
      const res = await srv.request("POST", "/api/groups", {
        token: user.token,
        body: { name: `Group ${i}` },
      });
      assert.equal(res.status, 201);
      assert.equal(res.data.group.role, "owner");
      assert.equal(res.data.group.member_count, 1);
      assert.ok(res.data.group.realtime_key);
    }

    const res21 = await srv.request("POST", "/api/groups", {
      token: user.token,
      body: { name: "Group 21" },
    });
    assert.equal(res21.status, 400);

    const listRes = await srv.request("GET", "/api/groups", { token: user.token });
    assert.equal(listRes.status, 200);
    assert.equal(listRes.data.groups.length, 20);
    assert.equal(listRes.data.groups[0].member_count, 1);
    assert.equal(listRes.data.groups[0].role, "owner");
  });

  it("enforces full role matrix across read, update, delete, members, and transfer", async () => {
    const owner = await srv.registerStudent({ name: "Owner User", email: "owner@example.com" });
    const admin = await srv.registerStudent({ name: "Admin User", email: "admin@example.com" });
    const admin2 = await srv.registerStudent({ name: "Admin Two", email: "admin2@example.com" });
    const member = await srv.registerStudent({ name: "Member User", email: "member@example.com" });
    const stranger = await srv.registerStudent({ name: "Stranger User", email: "stranger@example.com" });

    verifyStudent(srv.db, owner.student.id);

    const createRes = await srv.request("POST", "/api/groups", {
      token: owner.token,
      body: { name: "Calculus Crew", description: "Weekly problem sets" },
    });
    assert.equal(createRes.status, 201);
    const group = createRes.data.group;

    addMember(srv.db, group.id, admin.student.id, "admin");
    addMember(srv.db, group.id, admin2.student.id, "admin");
    addMember(srv.db, group.id, member.student.id, "member");

    // Non-member (stranger) gets 404 on every group endpoint
    for (const [method, path, body] of [
      ["GET", `/api/groups/${group.id}`],
      ["PATCH", `/api/groups/${group.id}`, { name: "Hacked" }],
      ["DELETE", `/api/groups/${group.id}`, { confirmName: "Calculus Crew" }],
      ["GET", `/api/groups/${group.id}/members`],
      ["PATCH", `/api/groups/${group.id}/members/${member.student.id}`, { role: "admin" }],
      ["DELETE", `/api/groups/${group.id}/members/${member.student.id}`],
      ["POST", `/api/groups/${group.id}/transfer`, { studentId: stranger.student.id }],
    ]) {
      const r = await srv.request(method, path, { token: stranger.token, body });
      assert.equal(r.status, 404, `Stranger ${method} ${path} must return 404`);
    }

    // GET /api/groups/:id includes realtime_key for members
    const memberGet = await srv.request("GET", `/api/groups/${group.id}`, { token: member.token });
    assert.equal(memberGet.status, 200);
    assert.equal(memberGet.data.group.realtime_key, group.realtime_key);
    assert.equal(memberGet.data.group.member_count, 4);

    // GET /api/groups/:id/members returns id, name, branch, year, role and NEVER email
    const membersRes = await srv.request("GET", `/api/groups/${group.id}/members`, { token: member.token });
    assert.equal(membersRes.status, 200);
    assert.equal(membersRes.data.members.length, 4);
    for (const m of membersRes.data.members) {
      assert.equal("email" in m, false, "email must never be returned");
      assert.ok(m.id);
      assert.ok(m.name);
      assert.ok(m.role);
    }

    // PATCH /api/groups/:id: member 403, admin 200
    const memberPatch = await srv.request("PATCH", `/api/groups/${group.id}`, {
      token: member.token,
      body: { name: "Nope" },
    });
    assert.equal(memberPatch.status, 403);

    const adminPatch = await srv.request("PATCH", `/api/groups/${group.id}`, {
      token: admin.token,
      body: { name: "Calculus Masters", description: "Updated desc" },
    });
    assert.equal(adminPatch.status, 200);
    assert.equal(adminPatch.data.group.name, "Calculus Masters");

    // PATCH /api/groups/:id/members/:sid: member 403, admin 403, owner 200
    const mRole = await srv.request("PATCH", `/api/groups/${group.id}/members/${member.student.id}`, {
      token: member.token,
      body: { role: "admin" },
    });
    assert.equal(mRole.status, 403);

    const aRole = await srv.request("PATCH", `/api/groups/${group.id}/members/${member.student.id}`, {
      token: admin.token,
      body: { role: "admin" },
    });
    assert.equal(aRole.status, 403);

    const oRolePromote = await srv.request("PATCH", `/api/groups/${group.id}/members/${member.student.id}`, {
      token: owner.token,
      body: { role: "admin" },
    });
    assert.equal(oRolePromote.status, 200);
    assert.equal(oRolePromote.data.member.role, "admin");

    const oRoleDemote = await srv.request("PATCH", `/api/groups/${group.id}/members/${member.student.id}`, {
      token: owner.token,
      body: { role: "member" },
    });
    assert.equal(oRoleDemote.status, 200);
    assert.equal(oRoleDemote.data.member.role, "member");

    // DELETE /api/groups/:id/members/:sid
    // Member cannot remove another member
    const mRemoveAdmin = await srv.request("DELETE", `/api/groups/${group.id}/members/${admin.student.id}`, {
      token: member.token,
    });
    assert.equal(mRemoveAdmin.status, 403);

    // Admin cannot remove another admin or owner
    const aRemoveAdmin = await srv.request("DELETE", `/api/groups/${group.id}/members/${admin2.student.id}`, {
      token: admin.token,
    });
    assert.equal(aRemoveAdmin.status, 403);

    const aRemoveOwner = await srv.request("DELETE", `/api/groups/${group.id}/members/${owner.student.id}`, {
      token: admin.token,
    });
    assert.equal(aRemoveOwner.status, 400);

    // Owner cannot leave without transferring
    const oLeave = await srv.request("DELETE", `/api/groups/${group.id}/members/${owner.student.id}`, {
      token: owner.token,
    });
    assert.equal(oLeave.status, 400);

    // Admin removes member -> rotates realtime_key and member immediately gets 404
    const keyBefore = srv.db.tables.study_groups.find((g) => g.id === group.id).realtime_key;
    const aRemoveMember = await srv.request("DELETE", `/api/groups/${group.id}/members/${member.student.id}`, {
      token: admin.token,
    });
    assert.equal(aRemoveMember.status, 200);
    const keyAfter = srv.db.tables.study_groups.find((g) => g.id === group.id).realtime_key;
    assert.notEqual(keyAfter, keyBefore);

    const removedGet = await srv.request("GET", `/api/groups/${group.id}`, { token: member.token });
    assert.equal(removedGet.status, 404);

    // Self-leave by admin2 rotates realtime_key
    const a2Leave = await srv.request("DELETE", `/api/groups/${group.id}/members/${admin2.student.id}`, {
      token: admin2.token,
    });
    assert.equal(a2Leave.status, 200);
    const keyAfterLeave = srv.db.tables.study_groups.find((g) => g.id === group.id).realtime_key;
    assert.notEqual(keyAfterLeave, keyAfter);

    // DELETE /api/groups/:id: admin 403, owner wrong confirmName 400
    const aDelete = await srv.request("DELETE", `/api/groups/${group.id}`, {
      token: admin.token,
      body: { confirmName: "Calculus Masters" },
    });
    assert.equal(aDelete.status, 403);

    const oDeleteWrong = await srv.request("DELETE", `/api/groups/${group.id}`, {
      token: owner.token,
      body: { confirmName: "Wrong Name" },
    });
    assert.equal(oDeleteWrong.status, 400);

    // Transfer ownership: admin 403, non-member 404, owner -> admin 200
    const aTransfer = await srv.request("POST", `/api/groups/${group.id}/transfer`, {
      token: admin.token,
      body: { studentId: admin.student.id },
    });
    assert.equal(aTransfer.status, 403);

    const oTransferStranger = await srv.request("POST", `/api/groups/${group.id}/transfer`, {
      token: owner.token,
      body: { studentId: stranger.student.id },
    });
    assert.equal(oTransferStranger.status, 404);

    const oTransfer = await srv.request("POST", `/api/groups/${group.id}/transfer`, {
      token: owner.token,
      body: { studentId: admin.student.id },
    });
    assert.equal(oTransfer.status, 200);

    // Former owner is now admin and cannot delete; new owner can delete
    const oldOwnerDelete = await srv.request("DELETE", `/api/groups/${group.id}`, {
      token: owner.token,
      body: { confirmName: "Calculus Masters" },
    });
    assert.equal(oldOwnerDelete.status, 403);

    const newOwnerDelete = await srv.request("DELETE", `/api/groups/${group.id}`, {
      token: admin.token,
      body: { confirmName: "Calculus Masters" },
    });
    assert.equal(newOwnerDelete.status, 200);
  });

  it("transfers or deletes groups and rotates keys on DELETE /api/auth/me", async () => {
    const owner = await srv.registerStudent({ email: "del-owner@example.com" });
    const olderMember = await srv.registerStudent({ email: "older-mem@example.com" });
    const olderAdmin = await srv.registerStudent({ email: "older-admin@example.com" });
    const newerAdmin = await srv.registerStudent({ email: "newer-admin@example.com" });
    const soleMember = await srv.registerStudent({ email: "sole-mem@example.com" });

    verifyStudent(srv.db, owner.student.id);
    verifyStudent(srv.db, soleMember.student.id);

    // Group 1: has older member, older admin, newer admin -> should go to older admin
    const g1 = (
      await srv.request("POST", "/api/groups", { token: owner.token, body: { name: "Group One" } })
    ).data.group;
    addMember(srv.db, g1.id, olderMember.student.id, "member", "2026-01-01T00:00:00.000Z");
    addMember(srv.db, g1.id, olderAdmin.student.id, "admin", "2026-01-02T00:00:00.000Z");
    addMember(srv.db, g1.id, newerAdmin.student.id, "admin", "2026-01-03T00:00:00.000Z");

    // Group 2: has only members -> should go to oldest member
    const g2 = (
      await srv.request("POST", "/api/groups", { token: owner.token, body: { name: "Group Two" } })
    ).data.group;
    addMember(srv.db, g2.id, newerAdmin.student.id, "member", "2026-01-05T00:00:00.000Z");
    addMember(srv.db, g2.id, olderMember.student.id, "member", "2026-01-01T00:00:00.000Z");

    // Group 3: no other members -> should be deleted
    const g3 = (
      await srv.request("POST", "/api/groups", { token: owner.token, body: { name: "Group Three" } })
    ).data.group;

    // Group 4: owned by someone else, deleting user is a member -> realtime_key should rotate
    const g4 = (
      await srv.request("POST", "/api/groups", { token: soleMember.token, body: { name: "Group Four" } })
    ).data.group;
    addMember(srv.db, g4.id, owner.student.id, "member", "2026-01-01T00:00:00.000Z");

    const delRes = await srv.request("DELETE", "/api/auth/me", { token: owner.token });
    assert.equal(delRes.status, 200);

    const g1Row = srv.db.tables.study_groups.find((g) => g.id === g1.id);
    assert.equal(g1Row.owner_id, olderAdmin.student.id);
    assert.notEqual(g1Row.realtime_key, g1.realtime_key);
    assert.equal(
      srv.db.tables.study_group_members.find((m) => m.group_id === g1.id && m.student_id === olderAdmin.student.id).role,
      "owner"
    );

    const g2Row = srv.db.tables.study_groups.find((g) => g.id === g2.id);
    assert.equal(g2Row.owner_id, olderMember.student.id);
    assert.notEqual(g2Row.realtime_key, g2.realtime_key);

    const g3Row = srv.db.tables.study_groups.find((g) => g.id === g3.id);
    assert.equal(g3Row, undefined);

    const g4Row = srv.db.tables.study_groups.find((g) => g.id === g4.id);
    assert.notEqual(g4Row.realtime_key, g4.realtime_key);
    assert.equal(
      srv.db.tables.study_group_members.some((m) => m.group_id === g4.id && m.student_id === owner.student.id),
      false
    );
  });

  it("enforces 75-member cap in join_study_group RPC", async () => {
    const owner = await srv.registerStudent({ email: "cap-owner@example.com" });
    verifyStudent(srv.db, owner.student.id);
    const group = (
      await srv.request("POST", "/api/groups", { token: owner.token, body: { name: "Big Group" } })
    ).data.group;

    // Owner is member #1; add 74 more members to reach 75
    for (let i = 2; i <= 75; i += 1) {
      const res = await srv.db.rpc("join_study_group", {
        p_group: group.id,
        p_student: crypto.randomUUID(),
      });
      assert.equal(res.data, "joined");
    }

    // 76th member is refused
    const res76 = await srv.db.rpc("join_study_group", {
      p_group: group.id,
      p_student: crypto.randomUUID(),
    });
    assert.equal(res76.data, "full");
  });
});
