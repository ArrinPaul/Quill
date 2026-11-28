"use client";

import { useState, type FormEvent } from "react";
import { Loading01 as Loader2 } from "@untitledui/icons";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { GroupReportTargetType } from "@/features/types";
import { GroupModal } from "./GroupModal";

interface ReportModalProps {
  open: boolean;
  groupId: string;
  targetType: GroupReportTargetType;
  targetId: string;
  targetLabel?: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function ReportModal({
  open,
  groupId,
  targetType,
  targetId,
  targetLabel,
  onClose,
  onSubmitted,
}: ReportModalProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    if (submitting) return;
    setReason("");
    setError("");
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Please describe the issue.");
      return;
    }
    if (trimmed.length > 500) {
      setError("Reason must be at most 500 characters.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await api.post(`/api/groups/${groupId}/reports`, {
        targetType,
        targetId,
        reason: trimmed,
      });
      toast.success("Report submitted to group admins.");
      setReason("");
      onSubmitted?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <GroupModal
      open={open}
      title={targetLabel ? `Report ${targetLabel}` : "Report an issue"}
      titleId="report-modal-title"
      busy={submitting}
      onClose={handleClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Group admins and the owner will review your report.
        </p>

        <div>
          <label htmlFor="report-reason" className="block text-sm font-medium text-foreground mb-1">
            Reason <span className="text-destructive">*</span>
          </label>
          <textarea
            id="report-reason"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe what happened..."
            rows={4}
            maxLength={500}
            required
            className="w-full rounded-[10px] border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
          <p className="mt-1 text-xs text-muted-foreground">{reason.trim().length}/500 characters</p>
        </div>

        {error && (
          <div role="alert" className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-standard disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full bg-destructive px-5 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-standard disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Submitting..." : "Submit report"}
          </button>
        </div>
      </form>
    </GroupModal>
  );
}
