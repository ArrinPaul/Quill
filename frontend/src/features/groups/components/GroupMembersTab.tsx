"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Flag01 as Flag,
  Loading01 as Loader2,
  RefreshCcw01 as RefreshCw,
  ShieldOff,
  Trash01 as Trash2,
} from "@untitledui/icons";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { BlockedStudent, GroupMember, StudyGroup } from "@/features/types";
import { ROLE_BADGE_CLASSES, ROLE_LABELS } from "@/features/groups/groupUtils";
import { GroupModal } from "./GroupModal";
import { ReportModal } from "./ReportModal";

interface GroupMembersTabProps {
  group: StudyGroup;
  currentUserId: string;
  onMemberCountChange: (count: number) => void;
}

export function GroupMembersTab({
  group,
  currentUserId,
  onMemberCountChange,
}: GroupMembersTabProps) {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingById, setPendingById] = useState<Record<string, boolean>>({});
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  const [removeTarget, setRemoveTarget] = useState<GroupMember | null>(null);
  const [banOnRemove, setBanOnRemove] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [removeError, setRemoveError] = useState("");

  const [reportTarget, setReportTarget] = useState<GroupMember | null>(null);

  const requestIdRef = useRef(0);

  const loadMembers = (reqId: number) => {
    Promise.all([
      api.get<{ members: GroupMember[] }>(`/api/groups/${group.id}/members`),
      api.get<{ blocks: BlockedStudent[] }>("/api/blocks").catch(() => ({ blocks: [] })),
    ])
      .then(([membersRes, blocksRes]) => {
        if (requestIdRef.current !== reqId) return;
        setMembers(membersRes.members);
        onMemberCountChange(membersRes.members.length);
        setBlockedIds(new Set(blocksRes.blocks.map((b) => b.blocked_id)));
        setError("");
      })
      .catch((err) => {
        if (requestIdRef.current !== reqId) return;
        setError(err instanceof Error ? err.message : "Failed to load members.");
      })
      .finally(() => {
        if (requestIdRef.current === reqId) setLoading(false);
      });
  };

  useEffect(() => {
    const reqId = ++requestIdRef.current;
    loadMembers(reqId);
    return () => {
      requestIdRef.current += 1;
    };
    // Keyed by group.id in parent; onMemberCountChange is stable callback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id]);

  const handleRetry = () => {
    setLoading(true);
    setError("");
    const reqId = ++requestIdRef.current;
    loadMembers(reqId);
  };

  const setItemPending = (id: string, busy: boolean) => {
    setPendingById((prev) => ({ ...prev, [id]: busy }));
  };

  const setItemError = (id: string, msg: string) => {
    setErrorById((prev) => ({ ...prev, [id]: msg }));
  };

  const handleRoleChange = async (member: GroupMember, nextRole: "admin" | "member") => {
    if (pendingById[member.id] || member.role === nextRole) return;
    const prevRole = member.role;

    setItemError(member.id, "");
    setItemPending(member.id, true);
    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, role: nextRole } : m))
    );

    try {
      await api.patch(`/api/groups/${group.id}/members/${member.id}`, { role: nextRole });
      toast.success(`Updated ${member.name}'s role to ${ROLE_LABELS[nextRole]}`);
    } catch (err) {
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, role: prevRole } : m))
      );
      setItemError(
        member.id,
        err instanceof Error ? err.message : "Failed to update member role."
      );
    } finally {
      setItemPending(member.id, false);
    }
  };

  const handleToggleBlock = async (member: GroupMember) => {
    if (pendingById[member.id]) return;
    const wasBlocked = blockedIds.has(member.id);

    setItemError(member.id, "");
    setItemPending(member.id, true);
    setBlockedIds((prev) => {
      const next = new Set(prev);
      if (wasBlocked) next.delete(member.id);
      else next.add(member.id);
      return next;
    });

    try {
      if (wasBlocked) {
        await api.delete(`/api/blocks/${member.id}`);
        toast.success(`Unblocked ${member.name}`);
      } else {
        await api.post("/api/blocks", { studentId: member.id });
        toast.success(`Blocked ${member.name}`);
      }
    } catch (err) {
      setBlockedIds((prev) => {
        const next = new Set(prev);
        if (wasBlocked) next.add(member.id);
        else next.delete(member.id);
        return next;
      });
      setItemError(
        member.id,
        err instanceof Error ? err.message : "Failed to update block status."
      );
    } finally {
      setItemPending(member.id, false);
    }
  };

  const openRemoveModal = (member: GroupMember) => {
    setRemoveTarget(member);
    setBanOnRemove(false);
    setBanReason("");
    setRemoveError("");
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget || pendingById[removeTarget.id]) return;
    const target = removeTarget;
    const snapshot = members;

    setRemoveError("");
    setItemError(target.id, "");
    setItemPending(target.id, true);

    try {
      await api.delete(`/api/groups/${group.id}/members/${target.id}`, {
        body: JSON.stringify({
          ban: banOnRemove,
          reason: banOnRemove && banReason.trim() ? banReason.trim() : undefined,
        }),
      });
      const updated = snapshot.filter((m) => m.id !== target.id);
      setMembers(updated);
      onMemberCountChange(updated.length);
      toast.success(
        banOnRemove ? `Removed and banned ${target.name}` : `Removed ${target.name}`
      );
      setRemoveTarget(null);
    } catch (err) {
      setMembers(snapshot);
      setRemoveError(
        err instanceof Error ? err.message : "Failed to remove member."
      );
    } finally {
      setItemPending(target.id, false);
    }
  };

  const canRemoveMember = (target: GroupMember): boolean => {
    if (target.id === currentUserId || target.role === "owner") return false;
    if (group.role === "owner") return true;
    if (group.role === "admin") return target.role === "member";
    return false;
  };

  if (loading) {
    return (
      <div className="space-y-3" aria-label="Loading members">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-[10px] border border-border bg-card p-4 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-[10px] border border-destructive/30 bg-destructive/10 p-5 text-center space-y-3"
      >
        <AlertCircle className="w-6 h-6 text-destructive mx-auto" />
        <p className="text-sm font-medium text-destructive">{error}</p>
        <button
          type="button"
          onClick={handleRetry}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-standard"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="rounded-[10px] border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No members found in this group.
      </div>
    );
  }

  const isRemoving = removeTarget ? Boolean(pendingById[removeTarget.id]) : false;

  return (
    <div className="space-y-3">
      {members.map((member) => {
        const isSelf = member.id === currentUserId;
        const isPending = Boolean(pendingById[member.id]);
        const itemError = errorById[member.id];
        const isBlocked = blockedIds.has(member.id);
        const canChangeRole =
          group.role === "owner" && !isSelf && member.role !== "owner";
        const removable = canRemoveMember(member);

        return (
          <div
            key={member.id}
            className="rounded-[10px] border border-border bg-card p-4 shadow-sm space-y-2"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm text-foreground break-words">
                    {member.name}
                  </span>
                  {isSelf && (
                    <span className="text-xs text-muted-foreground">(You)</span>
                  )}
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${ROLE_BADGE_CLASSES[member.role]}`}
                  >
                    {ROLE_LABELS[member.role]}
                  </span>
                  {isBlocked && (
                    <span className="inline-flex items-center rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      Blocked
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {member.branch} · Year {member.year}
                </p>
              </div>

              {!isSelf && (
                <div className="flex flex-wrap items-center gap-2">
                  {canChangeRole && (
                    <select
                      aria-label={`Role for ${member.name}`}
                      value={member.role}
                      disabled={isPending}
                      onChange={(e) =>
                        handleRoleChange(member, e.target.value as "admin" | "member")
                      }
                      className="rounded-full border border-border bg-input px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleToggleBlock(member)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-standard disabled:opacity-50"
                  >
                    <ShieldOff className="w-3.5 h-3.5" />
                    {isBlocked ? "Unblock" : "Block"}
                  </button>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setReportTarget(member)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-standard disabled:opacity-50"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    Report
                  </button>

                  {removable && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => openRemoveModal(member)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-standard disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>

            {itemError && (
              <p role="alert" className="text-xs text-destructive">
                {itemError}
              </p>
            )}
          </div>
        );
      })}

      <GroupModal
        open={Boolean(removeTarget)}
        title={removeTarget ? `Remove ${removeTarget.name}` : "Remove member"}
        titleId="remove-member-modal-title"
        busy={isRemoving}
        onClose={() => {
          if (!isRemoving) setRemoveTarget(null);
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {removeTarget?.name} will immediately lose access to this study group.
          </p>

          <label className="flex items-start gap-2.5 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={banOnRemove}
              onChange={(e) => setBanOnRemove(e.target.checked)}
              className="mt-0.5 rounded border-border"
            />
            <span>
              Also ban from rejoining
              <span className="block text-xs text-muted-foreground">
                Prevents this student from using invite links until unbanned.
              </span>
            </span>
          </label>

          {banOnRemove && (
            <div>
              <label
                htmlFor="ban-reason-input"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Reason (optional)
              </label>
              <textarea
                id="ban-reason-input"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Reason for ban..."
                className="w-full rounded-[10px] border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              />
            </div>
          )}

          {removeError && (
            <div
              role="alert"
              className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {removeError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRemoveTarget(null)}
              disabled={isRemoving}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-standard disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmRemove}
              disabled={isRemoving}
              className="inline-flex items-center gap-2 rounded-full bg-destructive px-5 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-standard disabled:opacity-50"
            >
              {isRemoving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isRemoving
                ? "Removing..."
                : banOnRemove
                  ? "Remove & ban"
                  : "Remove member"}
            </button>
          </div>
        </div>
      </GroupModal>

      {reportTarget && (
        <ReportModal
          open={Boolean(reportTarget)}
          groupId={group.id}
          targetType="member"
          targetId={reportTarget.id}
          targetLabel={reportTarget.name}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
}
