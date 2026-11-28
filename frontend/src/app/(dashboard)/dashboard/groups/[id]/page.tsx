"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  RefreshCcw01 as RefreshCw,
  Users01 as Users,
} from "@untitledui/icons";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { StudyGroup } from "@/features/types";
import {
  MAX_GROUP_MEMBERS,
  ROLE_BADGE_CLASSES,
  ROLE_LABELS,
} from "@/features/groups/groupUtils";
import { GroupOverviewTab } from "@/features/groups/components/GroupOverviewTab";
import { GroupMembersTab } from "@/features/groups/components/GroupMembersTab";
import { GroupSharedTab } from "@/features/groups/components/GroupSharedTab";
import { GroupSettingsTab } from "@/features/groups/components/GroupSettingsTab";

type GroupTab = "overview" | "members" | "shared" | "settings";

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const groupId = typeof params?.id === "string" ? params.id : "";
  const { user } = useAuth();

  const [group, setGroup] = useState<StudyGroup | null>(null);
  const [loadedId, setLoadedId] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<GroupTab>("overview");

  const requestIdRef = useRef(0);

  const loadGroup = useCallback((id: string, reqId: number) => {
    if (!id) return;
    api
      .get<{ group: StudyGroup }>(`/api/groups/${encodeURIComponent(id)}`)
      .then((res) => {
        if (requestIdRef.current !== reqId) return;
        setGroup(res.group);
        setLoadedId(id);
        setError("");
      })
      .catch((err) => {
        if (requestIdRef.current !== reqId) return;
        setGroup(null);
        setLoadedId(id);
        setError(err instanceof Error ? err.message : "Failed to load study group.");
      });
  }, []);

  useEffect(() => {
    if (!groupId) return;
    const reqId = ++requestIdRef.current;
    loadGroup(groupId, reqId);
    return () => {
      requestIdRef.current += 1;
    };
  }, [groupId, loadGroup]);

  const loading = Boolean(groupId && loadedId !== groupId);

  const handleRetry = () => {
    setLoadedId("");
    setError("");
    const reqId = ++requestIdRef.current;
    loadGroup(groupId, reqId);
  };

  const handleMemberCountChange = useCallback((count: number) => {
    setGroup((prev) => (prev ? { ...prev, member_count: count } : prev));
  }, []);

  const handleGroupUpdated = useCallback((patch: Partial<StudyGroup>) => {
    setGroup((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const handleOwnershipTransferred = useCallback(() => {
    setActiveTab("overview");
    setLoadedId("");
    const reqId = ++requestIdRef.current;
    loadGroup(groupId, reqId);
  }, [groupId, loadGroup]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6" aria-label="Loading study group">
        <div className="h-6 w-32 rounded bg-muted animate-pulse" />
        <div className="h-24 rounded-[10px] border border-border bg-card p-5 animate-pulse" />
        <div className="h-48 rounded-[10px] border border-border bg-card p-5 animate-pulse" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Link
          href="/dashboard/groups"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Groups
        </Link>
        <div
          role="alert"
          className="rounded-[10px] border border-destructive/30 bg-destructive/10 p-6 text-center space-y-3"
        >
          <AlertCircle className="w-6 h-6 text-destructive mx-auto" />
          <h1 className="text-base font-bold text-foreground">Group unavailable</h1>
          <p className="text-sm text-destructive">{error || "Study group not found."}</p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-standard"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
            <Link
              href="/dashboard/groups"
              className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-standard"
            >
              All groups
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const canManageSettings = group.role === "owner" || group.role === "admin";
  const tabs: { id: GroupTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "members", label: "Members" },
    { id: "shared", label: "Shared" },
    ...(canManageSettings ? [{ id: "settings" as const, label: "Settings" }] : []),
  ];

  const resolvedTab: GroupTab =
    activeTab === "settings" && !canManageSettings ? "overview" : activeTab;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <Link
          href="/dashboard/groups"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Groups
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground break-words">{group.name}</h1>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ROLE_BADGE_CLASSES[group.role]}`}
              >
                {ROLE_LABELS[group.role]}
              </span>
            </div>
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              {group.member_count} / {MAX_GROUP_MEMBERS} members
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Group sections"
        className="flex items-center gap-1 border-b border-border overflow-x-auto"
      >
        {tabs.map((tab) => {
          const selected = resolvedTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-standard ${
                selected
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {resolvedTab === "overview" && (
        <GroupOverviewTab
          group={group}
          currentUserId={user?.id ?? ""}
          onGoToSettings={canManageSettings ? () => setActiveTab("settings") : undefined}
        />
      )}

      {resolvedTab === "members" && (
        <GroupMembersTab
          key={group.id}
          group={group}
          currentUserId={user?.id ?? ""}
          onMemberCountChange={handleMemberCountChange}
        />
      )}

      {resolvedTab === "shared" && <GroupSharedTab />}

      {resolvedTab === "settings" && canManageSettings && (
        <GroupSettingsTab
          key={group.id}
          group={group}
          currentUserId={user?.id ?? ""}
          onGroupUpdated={handleGroupUpdated}
          onOwnershipTransferred={handleOwnershipTransferred}
        />
      )}
    </div>
  );
}
