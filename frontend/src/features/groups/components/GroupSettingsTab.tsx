"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Copy01 as Copy,
  Loading01 as Loader2,
  Plus,
  RefreshCcw01 as RefreshCw,
  Trash01 as Trash2,
} from "@untitledui/icons";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type {
  GroupAuditEntry,
  GroupBan,
  GroupInvite,
  GroupMember,
  GroupReport,
  StudyGroup,
} from "@/features/types";
import { formatShortDate, getInviteStatus } from "@/features/groups/groupUtils";
import { GroupModal } from "./GroupModal";

interface GroupSettingsTabProps {
  group: StudyGroup;
  currentUserId: string;
  onGroupUpdated: (patch: Partial<StudyGroup>) => void;
  onOwnershipTransferred: () => void;
}

function GroupDetailsForm({
  group,
  onGroupUpdated,
}: {
  group: StudyGroup;
  onGroupUpdated: (patch: Partial<StudyGroup>) => void;
}) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedDesc = description.trim();
    if (trimmedName.length < 3 || trimmedName.length > 60) {
      setError("Group name must be between 3 and 60 characters.");
      return;
    }
    if (trimmedDesc.length > 500) {
      setError("Description must be at most 500 characters.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await api.patch<{ group: StudyGroup }>(`/api/groups/${group.id}`, {
        name: trimmedName,
        description: trimmedDesc || null,
      });
      onGroupUpdated({
        name: res.group.name,
        description: res.group.description,
      });
      toast.success("Group details updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update group details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-[10px] border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
      <h2 className="text-base font-bold text-foreground">Group details</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="settings-group-name" className="block text-sm font-medium text-foreground mb-1">
            Group name
          </label>
          <input
            id="settings-group-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={3}
            maxLength={60}
            required
            className="w-full rounded-[10px] border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label htmlFor="settings-group-desc" className="block text-sm font-medium text-foreground mb-1">
            Description
          </label>
          <textarea
            id="settings-group-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="What is this group studying?"
            className="w-full rounded-[10px] border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />
          <p className="mt-1 text-xs text-muted-foreground">{description.trim().length}/500 characters</p>
        </div>

        {error && (
          <div role="alert" className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-standard disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </section>
  );
}

export function GroupSettingsTab({
  group,
  currentUserId,
  onGroupUpdated,
  onOwnershipTransferred,
}: GroupSettingsTabProps) {
  const router = useRouter();
  const isOwner = group.role === "owner";

  // Invites
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [invitesError, setInvitesError] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [maxUses, setMaxUses] = useState(25);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [createInviteError, setCreateInviteError] = useState("");
  const [newInviteCode, setNewInviteCode] = useState("");
  const [copiedType, setCopiedType] = useState<"code" | "link" | null>(null);
  const [pendingInviteById, setPendingInviteById] = useState<Record<string, boolean>>({});
  const [inviteErrorById, setInviteErrorById] = useState<Record<string, string>>({});

  // Reports
  const [reports, setReports] = useState<GroupReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState("");
  const [pendingReportById, setPendingReportById] = useState<Record<string, boolean>>({});
  const [reportErrorById, setReportErrorById] = useState<Record<string, string>>({});

  // Bans
  const [bans, setBans] = useState<GroupBan[]>([]);
  const [bansLoading, setBansLoading] = useState(true);
  const [bansError, setBansError] = useState("");
  const [pendingBanById, setPendingBanById] = useState<Record<string, boolean>>({});
  const [banErrorById, setBanErrorById] = useState<Record<string, string>>({});

  // Owner: transfer & audit & delete
  const [transferCandidates, setTransferCandidates] = useState<GroupMember[]>([]);
  const [selectedTransferId, setSelectedTransferId] = useState("");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState("");

  const [auditEntries, setAuditEntries] = useState<GroupAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(isOwner);
  const [auditError, setAuditError] = useState("");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const reqRef = useRef(0);

  const loadInvites = (id: number) => {
    api
      .get<{ invites: GroupInvite[] }>(`/api/groups/${group.id}/invites`)
      .then((res) => {
        if (reqRef.current !== id) return;
        setInvites(res.invites);
        setInvitesError("");
      })
      .catch((err) => {
        if (reqRef.current !== id) return;
        setInvitesError(err instanceof Error ? err.message : "Failed to load invites.");
      })
      .finally(() => {
        if (reqRef.current === id) setInvitesLoading(false);
      });
  };

  const loadReports = (id: number) => {
    api
      .get<{ reports: GroupReport[] }>(`/api/groups/${group.id}/reports`)
      .then((res) => {
        if (reqRef.current !== id) return;
        setReports(res.reports);
        setReportsError("");
      })
      .catch((err) => {
        if (reqRef.current !== id) return;
        setReportsError(err instanceof Error ? err.message : "Failed to load reports.");
      })
      .finally(() => {
        if (reqRef.current === id) setReportsLoading(false);
      });
  };

  const loadBans = (id: number) => {
    api
      .get<{ bans: GroupBan[] }>(`/api/groups/${group.id}/bans`)
      .then((res) => {
        if (reqRef.current !== id) return;
        setBans(res.bans);
        setBansError("");
      })
      .catch((err) => {
        if (reqRef.current !== id) return;
        setBansError(err instanceof Error ? err.message : "Failed to load banned members.");
      })
      .finally(() => {
        if (reqRef.current === id) setBansLoading(false);
      });
  };

  const loadOwnerData = (id: number) => {
    if (!isOwner) return;
    api
      .get<{ members: GroupMember[] }>(`/api/groups/${group.id}/members`)
      .then((res) => {
        if (reqRef.current !== id) return;
        const others = res.members.filter((m) => m.id !== currentUserId);
        setTransferCandidates(others);
        setSelectedTransferId((prev) =>
          others.some((m) => m.id === prev) ? prev : others[0]?.id ?? ""
        );
      })
      .catch(() => {
        // Non-fatal: transfer dropdown simply stays empty if members fail
      });

    api
      .get<{ entries: GroupAuditEntry[] }>(`/api/groups/${group.id}/audit`)
      .then((res) => {
        if (reqRef.current !== id) return;
        setAuditEntries(res.entries);
        setAuditError("");
      })
      .catch((err) => {
        if (reqRef.current !== id) return;
        setAuditError(err instanceof Error ? err.message : "Failed to load audit log.");
      })
      .finally(() => {
        if (reqRef.current === id) setAuditLoading(false);
      });
  };

  useEffect(() => {
    const id = ++reqRef.current;
    loadInvites(id);
    loadReports(id);
    loadBans(id);
    loadOwnerData(id);
    return () => {
      reqRef.current += 1;
    };
    // Keyed by group.id in parent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id, isOwner]);

  const handleCreateInvite = async (e: FormEvent) => {
    e.preventDefault();
    setCreatingInvite(true);
    setCreateInviteError("");
    try {
      const res = await api.post<{ invite: GroupInvite; code: string }>(
        `/api/groups/${group.id}/invites`,
        {
          expiresInDays: Number(expiresInDays),
          maxUses: Number(maxUses),
        }
      );
      setNewInviteCode(res.code);
      setInvites((prev) => [res.invite, ...prev]);
      toast.success("Invite created");
    } catch (err) {
      setCreateInviteError(err instanceof Error ? err.message : "Failed to create invite.");
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCopyInvite = async (mode: "code" | "link") => {
    if (!newInviteCode) return;
    const value =
      mode === "code"
        ? newInviteCode
        : `${typeof window !== "undefined" ? window.location.origin : ""}/join/${newInviteCode}`;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedType(mode);
      toast.success(mode === "code" ? "Invite code copied" : "Invite link copied");
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };

  const handleRevokeInvite = async (invite: GroupInvite) => {
    if (pendingInviteById[invite.id]) return;
    const prevInvites = invites;
    setInviteErrorById((prev) => ({ ...prev, [invite.id]: "" }));
    setPendingInviteById((prev) => ({ ...prev, [invite.id]: true }));
    setInvites((prev) =>
      prev.map((inv) =>
        inv.id === invite.id ? { ...inv, revoked_at: new Date().toISOString() } : inv
      )
    );

    try {
      const res = await api.delete<{ invite: GroupInvite }>(
        `/api/groups/${group.id}/invites/${invite.id}`
      );
      setInvites((prev) => prev.map((inv) => (inv.id === invite.id ? res.invite : inv)));
      toast.success("Invite revoked");
    } catch (err) {
      setInvites(prevInvites);
      setInviteErrorById((prev) => ({
        ...prev,
        [invite.id]: err instanceof Error ? err.message : "Failed to revoke invite.",
      }));
    } finally {
      setPendingInviteById((prev) => ({ ...prev, [invite.id]: false }));
    }
  };

  const handleResolveReport = async (
    report: GroupReport,
    status: "resolved" | "dismissed"
  ) => {
    if (pendingReportById[report.id]) return;
    const prevReports = reports;
    setReportErrorById((prev) => ({ ...prev, [report.id]: "" }));
    setPendingReportById((prev) => ({ ...prev, [report.id]: true }));
    setReports((prev) =>
      prev.map((r) => (r.id === report.id ? { ...r, status } : r))
    );

    try {
      const res = await api.patch<{ report: GroupReport }>(
        `/api/groups/${group.id}/reports/${report.id}`,
        { status }
      );
      setReports((prev) => prev.map((r) => (r.id === report.id ? res.report : r)));
      toast.success(`Report ${status}`);
    } catch (err) {
      setReports(prevReports);
      setReportErrorById((prev) => ({
        ...prev,
        [report.id]: err instanceof Error ? err.message : "Failed to update report.",
      }));
    } finally {
      setPendingReportById((prev) => ({ ...prev, [report.id]: false }));
    }
  };

  const handleUnban = async (ban: GroupBan) => {
    if (pendingBanById[ban.student_id]) return;
    const prevBans = bans;
    setBanErrorById((prev) => ({ ...prev, [ban.student_id]: "" }));
    setPendingBanById((prev) => ({ ...prev, [ban.student_id]: true }));
    setBans((prev) => prev.filter((b) => b.student_id !== ban.student_id));

    try {
      await api.delete(`/api/groups/${group.id}/bans/${ban.student_id}`);
      toast.success(`Unbanned ${ban.student?.name ?? "student"}`);
    } catch (err) {
      setBans(prevBans);
      setBanErrorById((prev) => ({
        ...prev,
        [ban.student_id]: err instanceof Error ? err.message : "Failed to unban member.",
      }));
    } finally {
      setPendingBanById((prev) => ({ ...prev, [ban.student_id]: false }));
    }
  };

  const handleTransferOwnership = async () => {
    if (!selectedTransferId) return;
    setTransferring(true);
    setTransferError("");
    try {
      await api.post(`/api/groups/${group.id}/transfer`, {
        studentId: selectedTransferId,
      });
      toast.success("Ownership transferred");
      setShowTransferModal(false);
      onOwnershipTransferred();
    } catch (err) {
      setTransferError(
        err instanceof Error ? err.message : "Failed to transfer ownership."
      );
    } finally {
      setTransferring(false);
    }
  };

  const handleDeleteGroup = async (e: FormEvent) => {
    e.preventDefault();
    if (confirmName.trim() !== group.name) {
      setDeleteError("Group name does not match.");
      return;
    }

    setDeleting(true);
    setDeleteError("");
    try {
      await api.delete(`/api/groups/${group.id}`, {
        body: JSON.stringify({ confirmName: confirmName.trim() }),
      });
      toast.success(`Deleted "${group.name}"`);
      router.push("/dashboard/groups");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete group.");
      setDeleting(false);
    }
  };

  const selectedCandidate = transferCandidates.find((c) => c.id === selectedTransferId);

  return (
    <div className="space-y-6">
      <GroupDetailsForm key={group.id} group={group} onGroupUpdated={onGroupUpdated} />

      {/* Invites */}
      <section className="rounded-[10px] border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Invite links</h2>
          <p className="text-xs text-muted-foreground">
            Create time-limited invite codes. Codes are shown only once at creation.
          </p>
        </div>

        <form onSubmit={handleCreateInvite} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label htmlFor="invite-expiry" className="block text-xs font-medium text-foreground mb-1">
              Expires in (days)
            </label>
            <input
              id="invite-expiry"
              type="number"
              min={1}
              max={30}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              className="w-full rounded-[10px] border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="invite-max-uses" className="block text-xs font-medium text-foreground mb-1">
              Max uses
            </label>
            <input
              id="invite-max-uses"
              type="number"
              min={1}
              max={100}
              value={maxUses}
              onChange={(e) => setMaxUses(Number(e.target.value))}
              className="w-full rounded-[10px] border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="submit"
            disabled={creatingInvite}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-standard disabled:opacity-50"
          >
            {creatingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {creatingInvite ? "Creating..." : "Create invite"}
          </button>
        </form>

        {createInviteError && (
          <div role="alert" className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {createInviteError}
          </div>
        )}

        {newInviteCode && (
          <div className="rounded-[10px] border border-primary/30 bg-primary/5 p-4 space-y-2">
            <p className="text-xs font-semibold text-primary">
              New invite created — copy it now, it will not be shown again:
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-card border border-border px-2.5 py-1 text-sm font-mono font-bold text-foreground">
                {newInviteCode}
              </code>
              <button
                type="button"
                onClick={() => handleCopyInvite("code")}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground hover:bg-muted transition-standard"
              >
                {copiedType === "code" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copy code
              </button>
              <button
                type="button"
                onClick={() => handleCopyInvite("link")}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground hover:bg-muted transition-standard"
              >
                {copiedType === "link" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copy /join link
              </button>
            </div>
          </div>
        )}

        {invitesLoading ? (
          <div className="h-16 rounded-[10px] bg-muted animate-pulse" />
        ) : invitesError ? (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-[10px] border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <span>{invitesError}</span>
            <button
              type="button"
              onClick={() => {
                setInvitesLoading(true);
                setInvitesError("");
                loadInvites(reqRef.current);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        ) : invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invites created yet.</p>
        ) : (
          <div className="space-y-2">
            {invites.map((inv) => {
              const status = getInviteStatus(inv);
              const isPending = Boolean(pendingInviteById[inv.id]);
              const err = inviteErrorById[inv.id];
              return (
                <div
                  key={inv.id}
                  className="rounded-[10px] border border-border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">
                        {inv.uses} / {inv.max_uses ?? "∞"} uses
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium border ${
                          status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:border-emerald-500/30"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {status === "active"
                          ? "Active"
                          : status === "revoked"
                            ? "Revoked"
                            : status === "expired"
                              ? "Expired"
                              : "Maxed out"}
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      Expires {formatShortDate(inv.expires_at)}
                    </p>
                    {err && (
                      <p role="alert" className="text-destructive">
                        {err}
                      </p>
                    )}
                  </div>
                  {status === "active" && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleRevokeInvite(inv)}
                      className="inline-flex items-center justify-center rounded-full border border-destructive/40 px-3 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 transition-standard disabled:opacity-50"
                    >
                      {isPending ? "Revoking..." : "Revoke"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Reports */}
      <section className="rounded-[10px] border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-foreground">Reports</h2>
        {reportsLoading ? (
          <div className="h-16 rounded-[10px] bg-muted animate-pulse" />
        ) : reportsError ? (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-[10px] border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <span>{reportsError}</span>
            <button
              type="button"
              onClick={() => {
                setReportsLoading(true);
                setReportsError("");
                loadReports(reqRef.current);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        ) : reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reports submitted in this group.</p>
        ) : (
          <div className="space-y-2">
            {reports.map((report) => {
              const isPending = Boolean(pendingReportById[report.id]);
              const err = reportErrorById[report.id];
              return (
                <div
                  key={report.id}
                  className="rounded-[10px] border border-border p-3 space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                          {report.target_type}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium border ${
                            report.status === "open"
                              ? "bg-amber-50 text-amber-700 border-amber-200 dark:border-amber-500/30"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {report.status}
                        </span>
                        <span className="text-muted-foreground">
                          {formatShortDate(report.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground break-words">{report.reason}</p>
                    </div>
                    {report.status === "open" && (
                      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleResolveReport(report, "resolved")}
                          className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-standard disabled:opacity-50"
                        >
                          Resolve
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleResolveReport(report, "dismissed")}
                          className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted transition-standard disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                  {err && (
                    <p role="alert" className="text-xs text-destructive">
                      {err}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Banned members */}
      <section className="rounded-[10px] border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-foreground">Banned members</h2>
        {bansLoading ? (
          <div className="h-16 rounded-[10px] bg-muted animate-pulse" />
        ) : bansError ? (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-[10px] border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <span>{bansError}</span>
            <button
              type="button"
              onClick={() => {
                setBansLoading(true);
                setBansError("");
                loadBans(reqRef.current);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        ) : bans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No banned members.</p>
        ) : (
          <div className="space-y-2">
            {bans.map((ban) => {
              const isPending = Boolean(pendingBanById[ban.student_id]);
              const err = banErrorById[ban.student_id];
              return (
                <div
                  key={ban.id}
                  className="rounded-[10px] border border-border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5 text-sm">
                    <p className="font-medium text-foreground">
                      {ban.student?.name ?? "Former member"}
                    </p>
                    {ban.student && (
                      <p className="text-xs text-muted-foreground">
                        {ban.student.branch} · Year {ban.student.year}
                      </p>
                    )}
                    {ban.reason && (
                      <p className="text-xs text-muted-foreground">Reason: {ban.reason}</p>
                    )}
                    {err && (
                      <p role="alert" className="text-xs text-destructive">
                        {err}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleUnban(ban)}
                    className="inline-flex items-center justify-center rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-standard disabled:opacity-50"
                  >
                    {isPending ? "Unbanning..." : "Unban"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {isOwner && (
        <>
          {/* Transfer ownership */}
          <section className="rounded-[10px] border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Transfer ownership</h2>
              <p className="text-xs text-muted-foreground">
                Promote another member to owner. You will become an admin.
              </p>
            </div>
            {transferCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add at least one other member to transfer ownership.
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <select
                  aria-label="Select new group owner"
                  value={selectedTransferId}
                  onChange={(e) => setSelectedTransferId(e.target.value)}
                  className="flex-1 rounded-[10px] border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {transferCandidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.branch} · Year {c.year})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedTransferId}
                  onClick={() => {
                    setTransferError("");
                    setShowTransferModal(true);
                  }}
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-standard disabled:opacity-50"
                >
                  Transfer ownership
                </button>
              </div>
            )}
          </section>

          {/* Audit log */}
          <section className="rounded-[10px] border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-foreground">Audit log</h2>
            {auditLoading ? (
              <div className="h-16 rounded-[10px] bg-muted animate-pulse" />
            ) : auditError ? (
              <div role="alert" className="flex items-center justify-between gap-3 rounded-[10px] border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <span className="inline-flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {auditError}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAuditLoading(true);
                    setAuditError("");
                    loadOwnerData(reqRef.current);
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry
                </button>
              </div>
            ) : auditEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {auditEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-[10px] border border-border px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <span className="font-mono font-semibold text-foreground">
                        {entry.action}
                      </span>
                      {entry.target && (
                        <span className="text-muted-foreground ml-2 break-all">
                          {entry.target}
                        </span>
                      )}
                    </div>
                    <span className="text-muted-foreground">
                      {formatShortDate(entry.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Danger zone */}
          <section className="rounded-[10px] border border-destructive/40 bg-card p-5 sm:p-6 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              <h2 className="text-base font-bold">Danger zone</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Deleting this group permanently removes all memberships, invites, and reports.
            </p>
            <button
              type="button"
              onClick={() => {
                setConfirmName("");
                setDeleteError("");
                setShowDeleteModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-standard"
            >
              <Trash2 className="w-4 h-4" />
              Delete group
            </button>
          </section>

          {/* Transfer modal */}
          <GroupModal
            open={showTransferModal}
            title="Transfer ownership"
            titleId="transfer-ownership-modal-title"
            busy={transferring}
            onClose={() => {
              if (!transferring) setShowTransferModal(false);
            }}
          >
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Transfer ownership of <strong className="text-foreground">{group.name}</strong> to{" "}
                <strong className="text-foreground">{selectedCandidate?.name ?? "this member"}</strong>?
                You will become an admin.
              </p>
              {transferError && (
                <div role="alert" className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {transferError}
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  disabled={transferring}
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-standard disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTransferOwnership}
                  disabled={transferring}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-standard disabled:opacity-50"
                >
                  {transferring && <Loader2 className="w-4 h-4 animate-spin" />}
                  {transferring ? "Transferring..." : "Confirm transfer"}
                </button>
              </div>
            </div>
          </GroupModal>

          {/* Delete modal */}
          <GroupModal
            open={showDeleteModal}
            title="Delete study group"
            titleId="delete-group-modal-title"
            busy={deleting}
            onClose={() => {
              if (!deleting) setShowDeleteModal(false);
            }}
          >
            <form onSubmit={handleDeleteGroup} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This cannot be undone. Type{" "}
                <strong className="text-foreground">{group.name}</strong> to confirm deletion.
              </p>
              <div>
                <label htmlFor="delete-confirm-name" className="block text-sm font-medium text-foreground mb-1">
                  Group name
                </label>
                <input
                  id="delete-confirm-name"
                  type="text"
                  autoFocus
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={group.name}
                  required
                  className="w-full rounded-[10px] border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {deleteError && (
                <div role="alert" className="rounded-[10px] border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {deleteError}
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-standard disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleting || confirmName.trim() !== group.name}
                  className="inline-flex items-center gap-2 rounded-full bg-destructive px-5 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-standard disabled:opacity-50"
                >
                  {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {deleting ? "Deleting..." : "Delete group"}
                </button>
              </div>
            </form>
          </GroupModal>
        </>
      )}
    </div>
  );
}
