"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Loading01 as Loader2,
  Plus,
  RefreshCcw01 as RefreshCw,
  Users01 as Users,
} from "@untitledui/icons";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { StudyGroup } from "@/features/types";
import {
  MAX_GROUP_MEMBERS,
  ROLE_BADGE_CLASSES,
  ROLE_LABELS,
  extractInviteCode,
} from "@/features/groups/groupUtils";
import { CreateGroupModal } from "@/features/groups/components/CreateGroupModal";

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [inviteInput, setInviteInput] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  const requestIdRef = useRef(0);

  const fetchGroups = (reqId: number) => {
    api
      .get<{ groups: StudyGroup[] }>("/api/groups")
      .then((res) => {
        if (requestIdRef.current !== reqId) return;
        setGroups(res.groups);
        setError("");
      })
      .catch((err) => {
        if (requestIdRef.current !== reqId) return;
        setError(err instanceof Error ? err.message : "Failed to load study groups.");
      })
      .finally(() => {
        if (requestIdRef.current === reqId) setLoading(false);
      });
  };

  useEffect(() => {
    const reqId = ++requestIdRef.current;
    fetchGroups(reqId);
    return () => {
      requestIdRef.current += 1;
    };
  }, []);

  const handleRetry = () => {
    setLoading(true);
    setError("");
    const reqId = ++requestIdRef.current;
    fetchGroups(reqId);
  };

  const handleJoinSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const code = extractInviteCode(inviteInput);
    if (!code) {
      setJoinError("Enter an invite code or /join link.");
      return;
    }

    setJoining(true);
    setJoinError("");
    try {
      const res = await api.post<{ group_id: string; status: "joined" | "already_member" }>(
        `/api/invites/${encodeURIComponent(code)}/accept`
      );
      toast.success(
        res.status === "already_member" ? "You're already in this group" : "Joined study group"
      );
      router.push(`/dashboard/groups/${res.group_id}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Failed to join study group.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Study Groups</h1>
          <p className="text-sm text-muted-foreground">
            Collaborate with classmates in private study groups (up to {MAX_GROUP_MEMBERS} members).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-standard flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create group
        </button>
      </div>

      {/* Join by invite code */}
      <section className="rounded-[10px] border border-border bg-card p-4 sm:p-5 shadow-sm space-y-3">
        <div>
          <h2 className="text-sm font-bold text-foreground">Join with an invite code</h2>
          <p className="text-xs text-muted-foreground">
            Paste a 16-character invite code or a full invite link.
          </p>
        </div>
        <form onSubmit={handleJoinSubmit} className="flex flex-col sm:flex-row gap-2">
          <label htmlFor="join-invite-code" className="sr-only">
            Invite code or link
          </label>
          <input
            id="join-invite-code"
            type="text"
            value={inviteInput}
            onChange={(e) => setInviteInput(e.target.value)}
            placeholder="e.g. ABCD2345EFGH6789 or /join/..."
            className="flex-1 rounded-[10px] border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={joining}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-5 py-2 text-sm font-medium text-foreground hover:bg-muted transition-standard disabled:opacity-50 flex-shrink-0"
          >
            {joining && <Loader2 className="w-4 h-4 animate-spin" />}
            {joining ? "Joining..." : "Join group"}
          </button>
        </form>
        {joinError && (
          <p role="alert" className="text-xs text-destructive">
            {joinError}
          </p>
        )}
      </section>

      {/* Group list */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-label="Loading groups">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 rounded-[10px] border border-border bg-card p-5 animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-[10px] border border-destructive/30 bg-destructive/10 p-6 text-center space-y-3"
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
      ) : groups.length === 0 ? (
        <div className="rounded-[10px] border border-border bg-card p-8 text-center shadow-sm space-y-3">
          <div className="mx-auto w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-foreground">No study groups yet</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Create your own study group or paste an invite code above to join an existing one.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-standard"
          >
            <Plus className="w-4 h-4" />
            Create your first group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/dashboard/groups/${group.id}`}
              className="group rounded-[10px] border border-border bg-card p-5 shadow-sm hover:border-primary/40 transition-standard flex flex-col justify-between gap-4"
            >
              <div className="space-y-2 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-bold text-foreground group-hover:text-primary transition-colors break-words min-w-0">
                    {group.name}
                  </h2>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold flex-shrink-0 ${ROLE_BADGE_CLASSES[group.role]}`}
                  >
                    {ROLE_LABELS[group.role]}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 break-words">
                  {group.description || "No description"}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {group.member_count} {group.member_count === 1 ? "member" : "members"}
                </span>
                <span className="inline-flex items-center gap-1 font-medium text-primary">
                  Open
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateGroupModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(created) => {
          setGroups((prev) => [created, ...prev]);
          setShowCreateModal(false);
        }}
      />
    </div>
  );
}
