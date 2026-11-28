import { describe, expect, it } from "vitest";
import { extractInviteCode, getInviteStatus } from "@/features/groups/groupUtils";
import type { GroupInvite } from "@/features/types";

describe("extractInviteCode", () => {
  it("normalizes raw invite codes", () => {
    expect(extractInviteCode("  abcd2345efgh6789  ")).toBe("ABCD2345EFGH6789");
  });

  it("extracts code from /join/ URLs", () => {
    expect(extractInviteCode("https://quill.app/join/abcd2345efgh6789?foo=1")).toBe(
      "ABCD2345EFGH6789"
    );
    expect(extractInviteCode("/join/xyzw2345abCD6789")).toBe("XYZW2345ABCD6789");
  });

  it("returns empty string for blank input", () => {
    expect(extractInviteCode("   ")).toBe("");
  });
});

describe("getInviteStatus", () => {
  const baseInvite: GroupInvite = {
    id: "inv-1",
    group_id: "grp-1",
    created_by: "stu-1",
    expires_at: "2099-01-01T00:00:00.000Z",
    max_uses: 25,
    uses: 0,
    revoked_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
  };

  it("returns active when not revoked, not expired, and under max_uses", () => {
    expect(getInviteStatus(baseInvite, Date.parse("2026-06-01T00:00:00.000Z"))).toBe("active");
  });

  it("returns revoked when revoked_at is set", () => {
    expect(
      getInviteStatus({ ...baseInvite, revoked_at: "2026-02-01T00:00:00.000Z" })
    ).toBe("revoked");
  });

  it("returns expired when expires_at is in the past", () => {
    expect(
      getInviteStatus(baseInvite, Date.parse("2099-01-02T00:00:00.000Z"))
    ).toBe("expired");
  });

  it("returns maxed when uses reaches max_uses", () => {
    expect(getInviteStatus({ ...baseInvite, uses: 25 })).toBe("maxed");
  });
});
