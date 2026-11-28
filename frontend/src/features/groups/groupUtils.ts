import type { GroupInvite, GroupRole } from "@/features/types";

export const MAX_GROUP_MEMBERS = 75;

export const ROLE_LABELS: Record<GroupRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export const ROLE_BADGE_CLASSES: Record<GroupRole, string> = {
  owner: "bg-primary/15 text-primary border-primary/25",
  admin: "bg-blue-50 text-blue-700 border-blue-200 dark:border-blue-500/30",
  member: "bg-muted text-muted-foreground border-border",
};

/**
 * Extracts a 16-character invite code from either a raw code or a `/join/<code>` URL.
 */
export function extractInviteCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const joinMatch = trimmed.match(/\/join\/([^/?#]+)/i);
  const candidate = joinMatch ? joinMatch[1] : trimmed;
  return candidate.trim().toUpperCase();
}

export type InviteStatus = "active" | "revoked" | "expired" | "maxed";

export function getInviteStatus(invite: GroupInvite, now = Date.now()): InviteStatus {
  if (invite.revoked_at) return "revoked";
  if (new Date(invite.expires_at).getTime() <= now) return "expired";
  if (invite.max_uses !== null && invite.uses >= invite.max_uses) return "maxed";
  return "active";
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
