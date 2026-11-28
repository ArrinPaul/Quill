"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle, Eye, EyeOff } from "@untitledui/icons";
import { PasswordStrengthMeter } from "@/features/auth/components/PasswordStrengthMeter";
import { api } from "@/lib/api";

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [devResetUrl, setDevResetUrl] = useState("");

  useEffect(() => {
    setError("");
    setSuccessMsg("");
    setDevResetUrl("");
  }, [token]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setDevResetUrl("");
    setLoading(true);

    try {
      const res = await api.post<{ message: string; resetUrl?: string }>("/api/auth/forgot-password", {
        email: email.trim(),
      });
      setSuccessMsg(res.message);
      if (res.resetUrl) {
        setDevResetUrl(res.resetUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request password reset");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<{ message: string }>("/api/auth/reset-password", {
        token,
        newPassword,
      });
      setSuccessMsg(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-[10px] border border-border p-8 shadow-sm">
      <div className="mb-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to login
        </Link>
        <h1 className="text-xl font-bold text-foreground" style={{ letterSpacing: "-0.02em" }}>
          {token ? "Set a new password" : "Reset your password"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {token
            ? "Choose a new password for your Quill account."
            : "Enter your account email to generate a password reset link."}
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-[10px] text-sm text-destructive">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-[10px] text-sm text-emerald-800 space-y-2">
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          {devResetUrl && (
            <div className="pt-1">
              <Link
                href={devResetUrl.replace(/^https?:\/\/[^/]+/, "")}
                className="text-xs font-semibold text-primary hover:underline break-all"
              >
                Open Reset Link →
              </Link>
            </div>
          )}
          {token && (
            <div className="pt-1">
              <Link href="/login" className="text-xs font-semibold text-primary hover:underline">
                Go to Login →
              </Link>
            </div>
          )}
        </div>
      )}

      {!token ? (
        <form onSubmit={handleRequestReset} className="space-y-4">
          <div>
            <label htmlFor="reset-email" className="block text-sm font-medium text-foreground mb-1.5">
              Email
            </label>
            <input
              id="reset-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="you@example.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary text-white font-medium rounded-full hover:bg-primary/90 transition-standard disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-foreground mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-border rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="At least 8 characters"
                required
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordStrengthMeter password={newPassword} />
          </div>

          <div>
            <label htmlFor="confirm-new-password" className="block text-sm font-medium text-foreground mb-1.5">
              Confirm New Password
            </label>
            <input
              id="confirm-new-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              placeholder="Repeat password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary text-white font-medium rounded-full hover:bg-primary/90 transition-standard disabled:opacity-50"
          >
            {loading ? "Updating..." : "Reset Password"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-card rounded-[10px] border border-border p-8 shadow-sm text-center text-sm text-muted-foreground">
          Loading...
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}
