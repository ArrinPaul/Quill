"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Users01, AlertCircle, CheckCircle } from "@untitledui/icons";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";

interface InvitePreview {
  group: {
    name: string;
    member_count: number;
  };
}

interface AcceptResponse {
  group_id: string;
  status: "joined" | "already_member";
}

export default function JoinGroupPage() {
  const params = useParams<{ code: string }>();
  const code = typeof params?.code === "string" ? params.code : "";
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [previewState, setPreviewState] = useState<{
    code: string;
    group: InvitePreview["group"] | null;
    error: string;
  }>({ code: "", group: null, error: "" });
  const [acceptError, setAcceptError] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinedGroupId, setJoinedGroupId] = useState<string | null>(null);
  const [joinStatus, setJoinStatus] = useState<"joined" | "already_member" | null>(null);

  const loadingPreview = Boolean(user && code && previewState.code !== code);
  const preview = previewState.code === code ? previewState.group : null;
  const previewError = previewState.code === code ? previewState.error : "";

  const isVerified = (user as (typeof user & { email_verified?: boolean }) | null)?.email_verified !== false;

  useEffect(() => {
    if (!authLoading && !user && code) {
      router.replace(`/login?redirect=${encodeURIComponent(`/join/${code}`)}`);
    }
  }, [authLoading, user, code, router]);

  useEffect(() => {
    if (authLoading || !user || !code) return;

    let cancelled = false;

    api
      .get<InvitePreview>(`/api/invites/${encodeURIComponent(code)}`)
      .then((res) => {
        if (!cancelled) {
          setPreviewState({ code, group: res.group, error: "" });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPreviewState({
            code,
            group: null,
            error: err instanceof Error ? err.message : "Invite not found or expired",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, code]);

  const handleJoin = async () => {
    setAcceptError("");
    setJoining(true);
    try {
      const res = await api.post<AcceptResponse>(`/api/invites/${encodeURIComponent(code)}/accept`);
      setJoinedGroupId(res.group_id);
      setJoinStatus(res.status);
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : "Failed to join study group");
    } finally {
      setJoining(false);
    }
  };

  if (authLoading || !user) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-card rounded-[10px] border border-border p-6 shadow-sm text-center">
          <p className="text-sm text-muted-foreground">
            {authLoading ? "Checking your session..." : "Redirecting to login..."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-card rounded-[10px] border border-border p-6 sm:p-8 shadow-sm">
        {loadingPreview ? (
          <div className="space-y-3 text-center py-4">
            <div className="h-5 w-40 bg-muted rounded mx-auto animate-pulse" />
            <div className="h-4 w-28 bg-muted rounded mx-auto animate-pulse" />
            <p className="text-sm text-muted-foreground pt-2">Loading invite details...</p>
          </div>
        ) : previewError ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div role="alert" className="space-y-1">
              <h1 className="text-lg font-bold text-foreground">Invite unavailable</h1>
              <p className="text-sm text-muted-foreground">{previewError}</p>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center w-full py-2.5 px-4 bg-primary text-white text-sm font-medium rounded-full hover:bg-primary/90 transition-standard"
            >
              Back to Dashboard
            </Link>
          </div>
        ) : joinedGroupId ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-foreground">
                {joinStatus === "already_member" ? "You're already a member" : "Joined study group"}
              </h1>
              <p className="text-sm text-muted-foreground">
                Welcome to <span className="font-medium text-foreground">{preview?.name}</span>.
              </p>
            </div>
            <Link
              href={`/dashboard/groups/${joinedGroupId}`}
              className="inline-flex items-center justify-center w-full py-2.5 px-4 bg-primary text-white text-sm font-medium rounded-full hover:bg-primary/90 transition-standard"
            >
              Open Study Group
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Users01 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Study Group Invite
                </p>
                <h1 className="text-xl font-bold text-foreground break-words">
                  {preview?.name}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {preview?.member_count} {preview?.member_count === 1 ? "member" : "members"} · Limit 75
                </p>
              </div>
            </div>

            {!isVerified && (
              <div
                role="alert"
                className="p-3 bg-destructive/10 border border-destructive/20 rounded-[10px] text-sm text-destructive space-y-2"
              >
                <p>Please verify your email before joining a study group.</p>
                <Link
                  href="/dashboard/settings"
                  className="inline-block font-medium underline hover:opacity-80"
                >
                  Go to Settings to verify email
                </Link>
              </div>
            )}

            {acceptError && (
              <div
                role="alert"
                className="p-3 bg-destructive/10 border border-destructive/20 rounded-[10px] text-sm text-destructive"
              >
                {acceptError}
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleJoin}
                disabled={joining || !isVerified || (preview?.member_count ?? 0) >= 75}
                className="w-full py-2.5 px-4 bg-primary text-white text-sm font-medium rounded-full hover:bg-primary/90 transition-standard disabled:opacity-50"
              >
                {joining
                  ? "Joining..."
                  : (preview?.member_count ?? 0) >= 75
                    ? "Group is full (75/75)"
                    : "Join Study Group"}
              </button>
              <Link
                href="/dashboard"
                className="w-full py-2 px-4 text-center text-sm text-muted-foreground hover:text-foreground rounded-full border border-border transition-standard"
              >
                Cancel
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
