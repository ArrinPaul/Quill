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
    body: { name: "Algorithms Study Group" },
  });
  assert.equal(res.status, 201);
  return { owner, group: res.data.group };
}

describe("C4 Study group invites", () => {
  let srv;

  beforeEach(async () => {
    srv = await startTestServer();
  });

  afterEach(async () => {
    await srv.close();
  });

  it("enforces role matrix (401/404/403/200) and hides code_hash on group invite routes", async () => {
    const { owner, group } = await createVerifiedGroup(srv);
    const admin = await srv.registerStudent({ email: "admin@example.com", name: "Admin" });
    const member = await srv.registerStudent({ email: "member@example.com", name: "Member" });
    const stranger = await srv.registerStudent({ email: "stranger@example.com", name: "Stranger" });
    const otherGroupRes = await createVerifiedGroup(srv, "other-owner@example.com");

    addMember(srv.db, group.id, admin.student.id, "admin");
    addMember(srv.db, group.id, member.student.id, "member");

    const fakeInviteId = crypto.randomUUID();

    // 401 unauthenticated
    assert.equal((await srv.request("POST", `/api/groups/${group.id}/invites`)).status, 401);
    assert.equal((await srv.request("GET", `/api/groups/${group.id}/invites`)).status, 401);
    assert.equal(
      (await srv.request("DELETE", `/api/groups/${group.id}/invites/${fakeInviteId}`)).status,
      401
    );

    // 404 non-member
    assert.equal(
      (await srv.request("POST", `/api/groups/${group.id}/invites`, { token: stranger.token })).status,
      404
    );
    assert.equal(
      (await srv.request("GET", `/api/groups/${group.id}/invites`, { token: stranger.token })).status,
      404
    );
    assert.equal(
      (
        await srv.request("DELETE", `/api/groups/${group.id}/invites/${fakeInviteId}`, {
          token: stranger.token,
        })
      ).status,
      404
    );

    // 403 member
    assert.equal(
      (await srv.request("POST", `/api/groups/${group.id}/invites`, { token: member.token })).status,
      403
    );
    assert.equal(
      (await srv.request("GET", `/api/groups/${group.id}/invites`, { token: member.token })).status,
      403
    );
    assert.equal(
      (
        await srv.request("DELETE", `/api/groups/${group.id}/invites/${fakeInviteId}`, {
          token: member.token,
        })
      ).status,
      403
    );

    // 201 admin creates invite with defaults (7 days, 25 uses)
    const createRes = await srv.request("POST", `/api/groups/${group.id}/invites`, {
      token: admin.token,
      body: {},
    });
    assert.equal(createRes.status, 201);
    assert.match(createRes.data.code, /^[A-Z2-7]{16}$/);
    assert.equal(createRes.data.invite.max_uses, 25);
    assert.equal(createRes.data.invite.uses, 0);
    assert.equal(createRes.data.invite.code_hash, undefined);

    // 200 owner lists invites without code_hash
    const listRes = await srv.request("GET", `/api/groups/${group.id}/invites`, {
      token: owner.token,
    });
    assert.equal(listRes.status, 200);
    assert.equal(listRes.data.invites.length, 1);
    assert.equal(listRes.data.invites[0].id, createRes.data.invite.id);
    assert.equal(listRes.data.invites[0].code_hash, undefined);

    // 404 revoking missing or wrong-group invite
    const missingRevoke = await srv.request(
      "DELETE",
      `/api/groups/${group.id}/invites/${fakeInviteId}`,
      { token: admin.token }
    );
    assert.equal(missingRevoke.status, 404);

    const wrongGroupRevoke = await srv.request(
      "DELETE",
      `/api/groups/${otherGroupRes.group.id}/invites/${createRes.data.invite.id}`,
      { token: otherGroupRes.owner.token }
    );
    assert.equal(wrongGroupRevoke.status, 404);

    // 200 admin revokes invite
    const revokeRes = await srv.request(
      "DELETE",
      `/api/groups/${group.id}/invites/${createRes.data.invite.id}`,
      { token: admin.token }
    );
    assert.equal(revokeRes.status, 200);
    assert.ok(revokeRes.data.invite.revoked_at);
  });

  it("returns same 404 message for invalid, expired, revoked, and exhausted invites", async () => {
    const { owner, group } = await createVerifiedGroup(srv);
    const joiner = await srv.registerStudent({ email: "joiner@example.com" });
    verifyStudent(srv.db, joiner.student.id);

    // Create 3 invites: one to expire, one to revoke, one with maxUses=1 to exhaust
    const expRes = await srv.request("POST", `/api/groups/${group.id}/invites`, {
      token: owner.token,
      body: { expiresInDays: 7, maxUses: 5 },
    });
    const revRes = await srv.request("POST", `/api/groups/${group.id}/invites`, {
      token: owner.token,
    });
    const exhRes = await srv.request("POST", `/api/groups/${group.id}/invites`, {
      token: owner.token,
      body: { maxUses: 1 },
    });

    // Valid preview returns ONLY group.name and group.member_count
    const previewRes = await srv.request("GET", `/api/invites/${exhRes.data.code.toLowerCase()}`);
    assert.equal(previewRes.status, 200);
    assert.deepEqual(previewRes.data, {
      group: { name: "Algorithms Study Group", member_count: 1 },
    });

    // Expire first invite
    const expRow = srv.db.tables.study_group_invites.find((i) => i.id === expRes.data.invite.id);
    expRow.expires_at = new Date(Date.now() - 60_000).toISOString();

    // Revoke second invite
    await srv.request("DELETE", `/api/groups/${group.id}/invites/${revRes.data.invite.id}`, {
      token: owner.token,
    });

    // Exhaust third invite
    const firstAccept = await srv.request("POST", `/api/invites/${exhRes.data.code}/accept`, {
      token: joiner.token,
    });
    assert.equal(firstAccept.status, 200);
    assert.deepEqual(firstAccept.data, { group_id: group.id, status: "joined" });

    const joiner2 = await srv.registerStudent({ email: "joiner2@example.com" });
    verifyStudent(srv.db, joiner2.student.id);

    const badCodes = [
      "NOTAVALIDCODE123",
      "short",
      expRes.data.code,
      revRes.data.code,
      exhRes.data.code,
    ];

    for (const code of badCodes) {
      const getRes = await srv.request("GET", `/api/invites/${code}`);
      assert.equal(getRes.status, 404);
      assert.equal(getRes.data.message, "Invite not found or expired");

      const postRes = await srv.request("POST", `/api/invites/${code}/accept`, {
        token: joiner2.token,
      });
      assert.equal(postRes.status, 404);
      assert.equal(postRes.data.message, "Invite not found or expired");
    }
  });

  it("rejects unverified users with 403 on accept", async () => {
    const { owner, group } = await createVerifiedGroup(srv);
    const unverified = await srv.registerStudent({ email: "unverified@example.com" });

    const inv = await srv.request("POST", `/api/groups/${group.id}/invites`, {
      token: owner.token,
    });

    const unauthAccept = await srv.request("POST", `/api/invites/${inv.data.code}/accept`);
    assert.equal(unauthAccept.status, 401);

    const acceptRes = await srv.request("POST", `/api/invites/${inv.data.code}/accept`, {
      token: unverified.token,
    });
    assert.equal(acceptRes.status, 403);
  });

  it("allows the 75th member and refuses the 76th with 409 including concurrent accepts", async () => {
    const { owner, group } = await createVerifiedGroup(srv);
    const inv = await srv.request("POST", `/api/groups/${group.id}/invites`, {
      token: owner.token,
      body: { maxUses: 10 },
    });

    // Owner is member #1; add 73 more to reach 74 members
    for (let i = 0; i < 73; i += 1) {
      addMember(srv.db, group.id, crypto.randomUUID(), "member");
    }

    const user75 = await srv.registerStudent({ email: "user75@example.com" });
    const user76 = await srv.registerStudent({ email: "user76@example.com" });
    verifyStudent(srv.db, user75.student.id);
    verifyStudent(srv.db, user76.student.id);

    const [resA, resB] = await Promise.all([
      srv.request("POST", `/api/invites/${inv.data.code}/accept`, { token: user75.token }),
      srv.request("POST", `/api/invites/${inv.data.code}/accept`, { token: user76.token }),
    ]);

    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    assert.deepEqual(statuses, [200, 409]);

    const finalMembers = srv.db.tables.study_group_members.filter((m) => m.group_id === group.id);
    assert.equal(finalMembers.length, 75);

    const invRow = srv.db.tables.study_group_invites.find((i) => i.id === inv.data.invite.id);
    assert.equal(invRow.uses, 1);
  });

  it("rate limits /api/invites/* to 10 attempts per 15 minutes", async () => {
    const prevEnable = process.env.ENABLE_RATE_LIMIT;
    process.env.ENABLE_RATE_LIMIT = "1";
    const rateSrv = await startTestServer();
    try {
      const ip = "198.51.100.55";
      for (let i = 0; i < 10; i += 1) {
        const res = await rateSrv.request("GET", "/api/invites/AAAAAAAAAAAAAAAA", {
          headers: { "X-Forwarded-For": ip },
        });
        assert.equal(res.status, 404);
      }

      const blocked = await rateSrv.request("GET", "/api/invites/AAAAAAAAAAAAAAAA", {
        headers: { "X-Forwarded-For": ip },
      });
      assert.equal(blocked.status, 429);
      assert.match(blocked.data.message, /^Too many attempts\. Try again in \d+ minutes\.$/);
    } finally {
      if (prevEnable === undefined) {
        delete process.env.ENABLE_RATE_LIMIT;
      } else {
        process.env.ENABLE_RATE_LIMIT = prevEnable;
      }
      await rateSrv.close();
    }
  });
});
