const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { startTestServer } = require("./helpers/testApp");

function verifyStudent(db, studentId) {
  const row = db.tables.students.find((s) => s.id === studentId);
  if (row) row.email_verified_at = new Date().toISOString();
}

function addMember(db, groupId, studentId, role = "member") {
  db.tables.study_group_members.push({
    id: crypto.randomUUID(),
    group_id: groupId,
    student_id: studentId,
    role,
    joined_at: new Date().toISOString(),
  });
}

async function createVerifiedGroup(srv, ownerEmail = "owner@example.com") {
  const owner = await srv.registerStudent({ email: ownerEmail, name: "Owner" });
  verifyStudent(srv.db, owner.student.id);
  const res = await srv.request("POST", "/api/groups", {
    token: owner.token,
    body: { name: "Safety Test Group" },
  });
  assert.equal(res.status, 201);
  return { owner, group: res.data.group };
}

describe("C5 Safety: blocks, reports, audit log, bans, and immediate access loss", () => {
  let srv;

  beforeEach(async () => {
    srv = await startTestServer();
  });

  afterEach(async () => {
    await srv.close();
  });

  it("rejects unauthenticated requests with 401 across blocks, reports, audit, and bans routes", async () => {
    const gid = crypto.randomUUID();
    const sid = crypto.randomUUID();
    const rid = crypto.randomUUID();

    const checks = [
      ["GET", "/api/blocks"],
      ["POST", "/api/blocks", { studentId: sid }],
      ["DELETE", `/api/blocks/${sid}`],
      ["POST", `/api/groups/${gid}/reports`, { targetType: "member", targetId: sid, reason: "Spam" }],
      ["GET", `/api/groups/${gid}/reports`],
      ["PATCH", `/api/groups/${gid}/reports/${rid}`, { status: "resolved" }],
      ["GET", `/api/groups/${gid}/audit`],
      ["GET", `/api/groups/${gid}/bans`],
      ["DELETE", `/api/groups/${gid}/bans/${sid}`],
    ];

    for (const [method, path, body] of checks) {
      const res = await srv.request(method, path, { body });
      assert.equal(res.status, 401, `${method} ${path} should return 401`);
    }
  });

  it("blocks and unblocks users, rejects self-block (400) and missing unblock (404), and never returns email", async () => {
    const alice = await srv.registerStudent({ email: "alice@example.com", name: "Alice" });
    const bob = await srv.registerStudent({ email: "bob@example.com", name: "Bob" });
    const unknownId = crypto.randomUUID();

    // Self-block -> 400
    const selfRes = await srv.request("POST", "/api/blocks", {
      token: alice.token,
      body: { studentId: alice.student.id },
    });
    assert.equal(selfRes.status, 400);

    // Unknown student -> 404
    const unknownRes = await srv.request("POST", "/api/blocks", {
      token: alice.token,
      body: { studentId: unknownId },
    });
    assert.equal(unknownRes.status, 404);

    // Block Bob -> 201, no email exposed
    const blockRes = await srv.request("POST", "/api/blocks", {
      token: alice.token,
      body: { studentId: bob.student.id },
    });
    assert.equal(blockRes.status, 201);
    assert.equal(blockRes.data.block.blocked_id, bob.student.id);
    assert.equal(blockRes.data.block.student.name, "Bob");
    assert.equal(blockRes.data.block.student.email, undefined);

    // List blocks -> includes Bob, never email
    const listRes = await srv.request("GET", "/api/blocks", { token: alice.token });
    assert.equal(listRes.status, 200);
    assert.equal(listRes.data.blocks.length, 1);
    assert.equal(listRes.data.blocks[0].blocked_id, bob.student.id);
    assert.equal(listRes.data.blocks[0].student.email, undefined);

    // Bob's own block list is isolated
    const bobList = await srv.request("GET", "/api/blocks", { token: bob.token });
    assert.equal(bobList.status, 200);
    assert.equal(bobList.data.blocks.length, 0);

    // Unblock Bob -> 200
    const unblockRes = await srv.request("DELETE", `/api/blocks/${bob.student.id}`, {
      token: alice.token,
    });
    assert.equal(unblockRes.status, 200);

    // Unblock again -> 404
    const missingUnblock = await srv.request("DELETE", `/api/blocks/${bob.student.id}`, {
      token: alice.token,
    });
    assert.equal(missingUnblock.status, 404);
  });

  it("enforces role matrix (404/403/200) for reports, audit log, and bans", async () => {
    const { owner, group } = await createVerifiedGroup(srv);
    const admin = await srv.registerStudent({ email: "admin@example.com", name: "Admin" });
    const member = await srv.registerStudent({ email: "member@example.com", name: "Member" });
    const stranger = await srv.registerStudent({ email: "stranger@example.com", name: "Stranger" });

    addMember(srv.db, group.id, admin.student.id, "admin");
    addMember(srv.db, group.id, member.student.id, "member");

    const fakeReportId = crypto.randomUUID();
    const fakeSid = crypto.randomUUID();

    // Non-member gets 404 on all group safety endpoints
    assert.equal(
      (
        await srv.request("POST", `/api/groups/${group.id}/reports`, {
          token: stranger.token,
          body: { targetType: "member", targetId: member.student.id, reason: "Spam" },
        })
      ).status,
      404
    );
    assert.equal((await srv.request("GET", `/api/groups/${group.id}/reports`, { token: stranger.token })).status, 404);
    assert.equal(
      (
        await srv.request("PATCH", `/api/groups/${group.id}/reports/${fakeReportId}`, {
          token: stranger.token,
          body: { status: "resolved" },
        })
      ).status,
      404
    );
    assert.equal((await srv.request("GET", `/api/groups/${group.id}/audit`, { token: stranger.token })).status, 404);
    assert.equal((await srv.request("GET", `/api/groups/${group.id}/bans`, { token: stranger.token })).status, 404);
    assert.equal(
      (await srv.request("DELETE", `/api/groups/${group.id}/bans/${fakeSid}`, { token: stranger.token })).status,
      404
    );

    // Member can create a report (201), but gets 403 on admin/owner routes
    const createReport = await srv.request("POST", `/api/groups/${group.id}/reports`, {
      token: member.token,
      body: { targetType: "message", targetId: crypto.randomUUID(), reason: "Harassment" },
    });
    assert.equal(createReport.status, 201);
    const reportId = createReport.data.report.id;
    assert.equal(createReport.data.report.status, "open");

    assert.equal((await srv.request("GET", `/api/groups/${group.id}/reports`, { token: member.token })).status, 403);
    assert.equal(
      (
        await srv.request("PATCH", `/api/groups/${group.id}/reports/${reportId}`, {
          token: member.token,
          body: { status: "resolved" },
        })
      ).status,
      403
    );
    assert.equal((await srv.request("GET", `/api/groups/${group.id}/audit`, { token: member.token })).status, 403);
    assert.equal((await srv.request("GET", `/api/groups/${group.id}/bans`, { token: member.token })).status, 403);
    assert.equal(
      (await srv.request("DELETE", `/api/groups/${group.id}/bans/${fakeSid}`, { token: member.token })).status,
      403
    );

    // Admin can list & resolve reports and view bans, but gets 403 on audit log
    const adminListReports = await srv.request("GET", `/api/groups/${group.id}/reports`, {
      token: admin.token,
    });
    assert.equal(adminListReports.status, 200);
    assert.equal(adminListReports.data.reports.length, 1);

    const resolveReport = await srv.request("PATCH", `/api/groups/${group.id}/reports/${reportId}`, {
      token: admin.token,
      body: { status: "resolved" },
    });
    assert.equal(resolveReport.status, 200);
    assert.equal(resolveReport.data.report.status, "resolved");
    assert.equal(resolveReport.data.report.resolved_by, admin.student.id);

    assert.equal((await srv.request("GET", `/api/groups/${group.id}/audit`, { token: admin.token })).status, 403);
    assert.equal((await srv.request("GET", `/api/groups/${group.id}/bans`, { token: admin.token })).status, 200);

    // Owner can view audit log
    const ownerAudit = await srv.request("GET", `/api/groups/${group.id}/audit`, {
      token: owner.token,
    });
    assert.equal(ownerAudit.status, 200);
    const actions = ownerAudit.data.entries.map((e) => e.action);
    assert.ok(actions.includes("report_create"));
    assert.ok(actions.includes("report_resolve"));
  });

  it("removes and bans member (immediate 404, key rotation, 403 rejoin), and unbanning allows rejoin", async () => {
    const { owner, group } = await createVerifiedGroup(srv);
    const admin = await srv.registerStudent({ email: "admin@example.com", name: "Admin" });
    const member = await srv.registerStudent({ email: "member@example.com", name: "Member" });
    verifyStudent(srv.db, member.student.id);

    addMember(srv.db, group.id, admin.student.id, "admin");

    // Create an invite and let member join
    const inviteRes = await srv.request("POST", `/api/groups/${group.id}/invites`, {
      token: admin.token,
      body: {},
    });
    assert.equal(inviteRes.status, 201);
    const code = inviteRes.data.code;

    const joinRes = await srv.request("POST", `/api/invites/${code}/accept`, {
      token: member.token,
    });
    assert.equal(joinRes.status, 200);
    assert.equal(joinRes.data.status, "joined");

    const keyBefore = srv.db.tables.study_groups.find((g) => g.id === group.id).realtime_key;

    // Remove and ban member via ?ban=true with reason
    const banRes = await srv.request("DELETE", `/api/groups/${group.id}/members/${member.student.id}?ban=true`, {
      token: admin.token,
      body: { reason: "Repeated spam" },
    });
    assert.equal(banRes.status, 200);
    assert.equal(banRes.data.banned, true);

    // Realtime key rotated
    const keyAfter = srv.db.tables.study_groups.find((g) => g.id === group.id).realtime_key;
    assert.notEqual(keyAfter, keyBefore);

    // Removed-and-banned member loses access immediately (404)
    assert.equal((await srv.request("GET", `/api/groups/${group.id}`, { token: member.token })).status, 404);
    assert.equal((await srv.request("GET", `/api/groups/${group.id}/members`, { token: member.token })).status, 404);

    // Cannot rejoin via invite -> 403
    const bannedJoin = await srv.request("POST", `/api/invites/${code}/accept`, {
      token: member.token,
    });
    assert.equal(bannedJoin.status, 403);

    // Cannot rejoin via join_study_group RPC -> 'banned'
    const rpcRes = await srv.db.rpc("join_study_group", {
      p_group: group.id,
      p_student: member.student.id,
    });
    assert.equal(rpcRes.data, "banned");

    // Admin can list bans (never email)
    const bansList = await srv.request("GET", `/api/groups/${group.id}/bans`, {
      token: admin.token,
    });
    assert.equal(bansList.status, 200);
    assert.equal(bansList.data.bans.length, 1);
    assert.equal(bansList.data.bans[0].student_id, member.student.id);
    assert.equal(bansList.data.bans[0].reason, "Repeated spam");
    assert.equal(bansList.data.bans[0].student.email, undefined);

    // Admin unbans member
    const unbanRes = await srv.request("DELETE", `/api/groups/${group.id}/bans/${member.student.id}`, {
      token: admin.token,
    });
    assert.equal(unbanRes.status, 200);

    // Unbanned member can now rejoin via invite -> 200
    const rejoinRes = await srv.request("POST", `/api/invites/${code}/accept`, {
      token: member.token,
    });
    assert.equal(rejoinRes.status, 200);
    assert.equal(rejoinRes.data.status, "joined");

    // Verify audit log recorded invite_create, member_ban, and member_unban
    const auditRes = await srv.request("GET", `/api/groups/${group.id}/audit`, {
      token: owner.token,
    });
    assert.equal(auditRes.status, 200);
    const actions = auditRes.data.entries.map((e) => e.action);
    assert.ok(actions.includes("invite_create"));
    assert.ok(actions.includes("member_ban"));
    assert.ok(actions.includes("member_unban"));
  });

  it("records role_change, ownership_transfer, member_remove, and invite_revoke in audit_log", async () => {
    const { owner, group } = await createVerifiedGroup(srv);
    const memberA = await srv.registerStudent({ email: "a@example.com", name: "Member A" });
    const memberB = await srv.registerStudent({ email: "b@example.com", name: "Member B" });
    addMember(srv.db, group.id, memberA.student.id, "member");
    addMember(srv.db, group.id, memberB.student.id, "member");

    // Role change
    const roleRes = await srv.request("PATCH", `/api/groups/${group.id}/members/${memberA.student.id}`, {
      token: owner.token,
      body: { role: "admin" },
    });
    assert.equal(roleRes.status, 200);

    // Invite create + revoke
    const invRes = await srv.request("POST", `/api/groups/${group.id}/invites`, {
      token: owner.token,
      body: {},
    });
    assert.equal(invRes.status, 201);
    const revRes = await srv.request("DELETE", `/api/groups/${group.id}/invites/${invRes.data.invite.id}`, {
      token: owner.token,
    });
    assert.equal(revRes.status, 200);

    // Remove without ban
    const remRes = await srv.request("DELETE", `/api/groups/${group.id}/members/${memberB.student.id}`, {
      token: owner.token,
    });
    assert.equal(remRes.status, 200);
    assert.equal(remRes.data.banned, false);

    // Transfer ownership to memberA
    const trRes = await srv.request("POST", `/api/groups/${group.id}/transfer`, {
      token: owner.token,
      body: { studentId: memberA.student.id },
    });
    assert.equal(trRes.status, 200);

    // New owner (memberA) can read audit log
    const auditRes = await srv.request("GET", `/api/groups/${group.id}/audit`, {
      token: memberA.token,
    });
    assert.equal(auditRes.status, 200);
    const actions = auditRes.data.entries.map((e) => e.action);
    assert.ok(actions.includes("role_change"));
    assert.ok(actions.includes("invite_create"));
    assert.ok(actions.includes("invite_revoke"));
    assert.ok(actions.includes("member_remove"));
    assert.ok(actions.includes("ownership_transfer"));
  });
});
