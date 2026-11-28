"use client";
import { useEscape } from "@/hooks/useEscape";
import { toast } from 'sonner';

import { useEffect, useState } from "react";
import { AlertTriangle, Calendar, Check, Copy01 as Copy, Key01 as Key, Loading01 as Loader2, Plus, RefreshCcw01 as RefreshCw, Save01 as Save, Settings01 as Settings, User01 as User, XClose as X } from "@untitledui/icons";
import { API_BASE, api } from "@/lib/api";
import { EmailSettingsCard } from "@/features/settings/EmailSettingsCard";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

const branches = ["CSE", "IT", "ECE", "EEE", "ME", "CE", "Other"];
const years = [1, 2, 3, 4];

export default function SettingsPage() {
  const { user, logout } = useAuth();
  
  // Profile form states
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("");
  const [year, setYear] = useState<number>(1);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState("");

  // System states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  useEscape(showDeleteConfirm && !deletingAccount, () => setShowDeleteConfirm(false));

  // Change password states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Calendar feed states
  const [feedUrl, setFeedUrl] = useState("");
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [copiedFeed, setCopiedFeed] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resettingFeed, setResettingFeed] = useState(false);
  useEscape(showResetConfirm && !resettingFeed, () => setShowResetConfirm(false));

  const buildFeedUrl = (path: string) => {
    const base = API_BASE || (typeof window !== "undefined" ? window.location.origin : "");
    return `${base}${path}`;
  };

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setBranch(user.branch || "");
      setYear(user.year || 1);
      setSubjects(user.subjects || []);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    api
      .get<{ path: string }>("/api/calendar/feed-url")
      .then((res) => {
        if (!active) return;
        setFeedUrl(buildFeedUrl(res.path));
        setFeedError("");
        setFeedLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setFeedError(err instanceof Error ? err.message : "Failed to load calendar link");
        setFeedLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const handleRetryFeedUrl = async () => {
    setFeedLoading(true);
    setFeedError("");
    try {
      const res = await api.get<{ path: string }>("/api/calendar/feed-url");
      setFeedUrl(buildFeedUrl(res.path));
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : "Failed to load calendar link");
    } finally {
      setFeedLoading(false);
    }
  };

  const handleCopyFeedUrl = async () => {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopiedFeed(true);
      toast.success("Calendar link copied to clipboard");
      setTimeout(() => setCopiedFeed(false), 2000);
    } catch {
      toast.error("Could not copy link. Please copy it manually.");
    }
  };

  const handleResetFeedUrl = async () => {
    setResettingFeed(true);
    try {
      const res = await api.post<{ path: string }>("/api/calendar/feed-reset");
      setFeedUrl(buildFeedUrl(res.path));
      setCopiedFeed(false);
      setShowResetConfirm(false);
      toast.success("Calendar link reset. Previous links are now revoked.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset calendar link");
    } finally {
      setResettingFeed(false);
    }
  };

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim()) return;
    const normalized = newSubject.trim().toUpperCase();
    if (!subjects.includes(normalized)) {
      setSubjects([...subjects, normalized]);
    }
    setNewSubject("");
  };

  const handleRemoveSubject = (sub: string) => {
    setSubjects(subjects.filter((s) => s !== sub));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("Quill_token");
      const res = await api.put<{ student: typeof user }>("/api/auth/me", {
        name: name.trim(),
        branch,
        year,
        subjects
      }, { token: token || undefined });
      
      // Update local storage/context user details if needed by refreshing
      setSuccessMsg("Profile details updated successfully!");
      setTimeout(() => {
        // Trigger page refresh to reload auth details
        window.location.reload();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile details");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!currentPassword || !newPassword) {
      setError("Please enter your current and new password");
      toast.error("Please enter your current and new password");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("New passwords do not match");
      toast.error("New passwords do not match");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await api.put<{ message: string; token?: string }>("/api/auth/password", {
        currentPassword,
        newPassword,
      });
      if (res.token) {
        localStorage.setItem("Quill_token", res.token);
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setSuccessMsg("Password updated successfully!");
      toast.success("Password updated successfully!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update password";
      setError(msg);
      toast.error(msg);
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
        <p className="text-sm text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">Manage profile, integrations, and synced services</p>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-[10px] text-sm text-destructive animate-in fade-in duration-200">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-[10px] text-sm text-green-600 animate-in fade-in duration-200">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side: Appearance */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-card border border-border rounded-[10px] p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-foreground text-base border-b border-border pb-3">Appearance</h3>
            <ThemeToggle showLabel className="w-full justify-center border border-border py-2.5" />
          </div>
        </div>

        {/* Right Side: Profile Details */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-[10px] p-6 shadow-sm space-y-6">
            <h3 className="font-semibold text-foreground text-base flex items-center gap-2 border-b border-border pb-3">
              <User className="w-4 h-4 text-primary" />
              Student Profile
            </h3>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">
                    Email (Read-only)
                  </label>
                  <input
                    type="email"
                    value={user?.email || ""}
                    className="w-full px-3 py-2 border border-border rounded-[10px] text-sm bg-muted text-muted-foreground cursor-not-allowed"
                    disabled
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">
                    Branch
                  </label>
                  <select
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card"
                  >
                    <option value="">Select</option>
                    {branches.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">
                    Year of Study
                  </label>
                  <select
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-border rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>Year {y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subjects tags manager */}
              <div className="border-t border-border pt-4">
                <label className="block text-xs font-semibold text-foreground mb-2 uppercase tracking-wider">
                  Subjects/Courses List
                </label>
                
                {/* Current tags */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {subjects.map((sub) => (
                    <span 
                      key={sub}
                      className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-primary/5 text-primary border border-primary/10 text-xs font-bold rounded-full"
                    >
                      {sub}
                      <button
                        type="button"
                        onClick={() => handleRemoveSubject(sub)}
                        className="p-0.5 hover:bg-primary/10 rounded-full cursor-pointer text-primary"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {subjects.length === 0 && (
                    <span className="text-xs text-muted-foreground italic py-1">No subjects listed yet. Add your courses below.</span>
                  )}
                </div>

                {/* Add subject input bar */}
                <div className="flex gap-2 max-w-sm">
                  <input
                    type="text"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSubject(e);
                      }
                    }}
                    placeholder="e.g., DBMS"
                    className="flex-1 px-3 py-1.5 border border-border rounded-[10px] text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubject}
                    className="px-3 py-1.5 bg-muted text-foreground border border-border hover:bg-accent rounded-[10px] text-xs font-medium cursor-pointer flex items-center gap-1 transition-standard"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              </div>

              <div className="flex justify-end border-t border-border pt-4 mt-6">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-[10px] hover:opacity-90 transition-standard cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Profile Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="bg-card border border-border rounded-[10px] p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-foreground text-base flex items-center gap-2 border-b border-border pb-3">
              <Key className="w-4 h-4 text-primary" />
              Change Password
            </h3>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label htmlFor="current-password" className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">
                  Current Password
                </label>
                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="new-password-settings" className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">
                    New Password
                  </label>
                  <input
                    id="new-password-settings"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="At least 6 characters"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="confirm-new-password-settings" className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">
                    Confirm New Password
                  </label>
                  <input
                    id="confirm-new-password-settings"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Repeat new password"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-[10px] hover:opacity-90 transition-standard cursor-pointer disabled:opacity-50"
                >
                  {changingPassword ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </button>
              </div>
            </form>
          </div>

          <EmailSettingsCard />

          {/* Calendar Feed Card */}
          <div className="bg-card border border-border rounded-[10px] p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-foreground text-base flex items-center gap-2 border-b border-border pb-3">
              <Calendar className="w-4 h-4 text-primary" />
              Calendar feed
            </h3>

            <p className="text-sm text-muted-foreground">
              Subscribe to your tasks and class events in Google Calendar, Apple Calendar, or Outlook using this private .ics link.
            </p>

            <div className="flex items-start gap-2.5 p-3 rounded-[10px] bg-amber-500/10 border border-amber-500/20 text-xs text-foreground">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p>
                Anyone with this link can read your tasks. Reset the link if you ever share it by mistake.
              </p>
            </div>

            {feedLoading ? (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Loading calendar link...
              </div>
            ) : feedError ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-[10px] bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                <span>{feedError}</span>
                <button
                  type="button"
                  onClick={handleRetryFeedUrl}
                  className="shrink-0 px-3 py-1.5 rounded-[10px] border border-border bg-card text-foreground text-xs font-medium hover:bg-muted transition-standard cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    readOnly
                    value={feedUrl}
                    aria-label="Calendar feed URL"
                    onClick={(e) => e.currentTarget.select()}
                    className="w-full min-w-0 flex-1 px-3 py-2 border border-border rounded-[10px] text-xs bg-muted text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopyFeedUrl}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-[10px] hover:opacity-90 transition-standard cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {copiedFeed ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy calendar link
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(true)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-border bg-card text-foreground text-xs font-medium rounded-[10px] hover:bg-muted transition-standard cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Reset link
                    </button>
                  </div>
                </div>

                <div className="rounded-[10px] border border-border bg-muted/40 p-3 space-y-1.5 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">How to subscribe</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      <span className="font-medium text-foreground">Google Calendar:</span> Other calendars (+) → From URL → paste the link.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Apple Calendar:</span> File → New Calendar Subscription → paste the link.
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Outlook:</span> Add calendar → Subscribe from web → paste the link.
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Danger Zone */}
          <div className="bg-red-50 border border-red-200 rounded-[10px] p-6 shadow-sm space-y-4">
            <h3 className="font-semibold text-red-700 text-base flex items-center gap-2 border-b border-red-200 pb-3">
              Danger Zone
            </h3>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-red-900">Delete Account and My Data</p>
                <p className="text-xs text-red-700 mt-1 max-w-md">
                  Once you delete your account, there is no going back. All your tasks, attendance, notes, and profile data will be permanently wiped.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="shrink-0 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-[10px] hover:bg-red-700 transition-colors cursor-pointer"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {showResetConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-feed-title"
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
          onClick={() => !resettingFeed && setShowResetConfirm(false)}
        >
          <div
            className="bg-card rounded-[12px] border border-border shadow-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="reset-feed-title" className="text-lg font-bold text-foreground">
              Reset Calendar Link?
            </h3>
            <p className="text-sm text-muted-foreground">
              This will generate a new calendar feed URL and immediately revoke your old link. Any calendar app using the old link will stop syncing until you update it.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={resettingFeed}
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 border border-border rounded-[10px] text-sm font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resettingFeed}
                onClick={handleResetFeedUrl}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-[10px] text-sm font-semibold hover:opacity-90 transition-colors cursor-pointer disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {resettingFeed ? "Resetting..." : "Yes, Reset Link"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div role="dialog" aria-modal="true"
          className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200"
          onClick={() => !deletingAccount && setShowDeleteConfirm(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="bg-card rounded-[12px] border border-border shadow-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-account-title" className="text-lg font-bold text-foreground">
              Delete Account Permanently?
            </h3>
            <p className="text-sm text-muted-foreground">
              This will permanently wipe your tasks, attendance records, notices, flashcards, quizzes, and profile. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deletingAccount}
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-border rounded-[10px] text-sm font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingAccount}
                onClick={async () => {
                  setDeletingAccount(true);
                  try {
                    await api.delete("/api/auth/me");
                    logout();
                  } catch (err) {
                    toast.error("Failed to delete account: " + (err instanceof Error ? err.message : "Unknown error"));
                    setDeletingAccount(false);
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-[10px] text-sm font-semibold hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {deletingAccount ? "Deleting..." : "Yes, Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
