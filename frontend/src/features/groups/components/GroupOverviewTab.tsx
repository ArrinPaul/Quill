"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag01 as Flag, Loading01 as Loader2, LogOut01 as LogOut, Users01 as Users } from "@untitledui/icons";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { StudyGroup } from "@/features/types";
import {
  MAX_GROUP_MEMBERS,
  ROLE_BADGE_CLASSES,
  ROLE_LABELS,
  formatShortDate,
} from "@/features/groups/groupUtils";
import { GroupModal } from "./GroupModal";
import { ReportModal } from "./ReportModal";

interface GroupOverviewTabProps {
  group: StudyGroup;
  currentUserId: string;
  onGoToSettings?: () => void;
}

export function GroupOverviewTab({
  group,
  currentUserId,
  onGoToSettings,
}: GroupOverviewTabProps) {
  const router = useRouter();
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);

  const isOwner = group.role === "owner";

  const handleLeave = async () => {
    setLeaving(true);
    setLeaveError("");
    try {
      await api.delete(`/api/groups/${group.id}/members/${currentUserId}`);
      toast.success(`Left "${group.name}"`);
      router.push("/dashboard/groups");
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : "Failed to leave group.");
      setLeaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[10px] border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h2 className="text-lg font-bold text-foreground break-words">{group.name}</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
              {group.description || "No description provided."}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE_CLASSES[group.role]}`}
          >
            {ROLE_LABELS[group.role]}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-4 h-4 flex-shrink-0" />
            <span>
              <strong className="text-foreground font-semibold">{group.member_count}</strong> /{" "}
              {MAX_GROUP_MEMBERS} members
            </span>
          </div>
          <div className="text-muted-foreground sm:text-right">
            Created {formatShortDate(group.created_at)}
          </div>
        </div>
      </section>

      <section className="rounded-[10px] border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-foreground">Group actions</h3>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div>
            <p className="text-sm font-medium text-foreground">Report an issue</p>
            <p className="text-xs text-muted-foreground">
              Flag inappropriate content or behavior for group admins to review.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-standard flex-shrink-0"
          >
            <Flag className="w-4 h-4" />
            Report issue
          </button>
        </div>

        <div className="border-t border-border pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Leave study group</p>
            {isOwner ? (
              <p className="text-xs text-muted-foreground">
                Owners cannot leave without transferring ownership to another member first.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                You will immediately lose access to this group unless invited again.
              </p>
            )}
          </div>

          {isOwner ? (
            onGoToSettings ? (
              <button
                type="button"
                onClick={onGoToSettings}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-standard flex-shrink-0"
              >
                Transfer ownership
              </button>
            ) : null
          ) : (
            <button
              type="button"
              onClick={() => {
                setLeaveError("");
                setShowLeaveModal(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-standard flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
              Leave group
            </button>
          )}
        </div>
      </section>

      <GroupModal
        open={showLeaveModal}
        title="Leave study group"
        titleId="leave-group-modal-title"
        busy={leaving}
        onClose={() => {
          if (!leaving) setShowLeaveModal(false);
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to leave{" "}
            <strong className="text-foreground">{group.name}</strong>? You will need a new invite
            to rejoin.
          </p>

          {leaveError && (
            <div
              role="alert"
              className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {leaveError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowLeaveModal(false)}
              disabled={leaving}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-standard disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLeave}
              disabled={leaving}
              className="inline-flex items-center gap-2 rounded-full bg-destructive px-5 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-standard disabled:opacity-50"
            >
              {leaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {leaving ? "Leaving..." : "Leave group"}
            </button>
          </div>
        </div>
      </GroupModal>

      <ReportModal
        open={showReportModal}
        groupId={group.id}
        targetType="other"
        targetId={group.id}
        onClose={() => setShowReportModal(false)}
      />
    </div>
  );
}
