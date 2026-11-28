"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Loading01 as Loader2, Mail01 as Mail } from "@untitledui/icons";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface EmailVerificationCardProps {
  email: string;
  initialVerified: boolean;
}

export function EmailVerificationCard({ email, initialVerified }: EmailVerificationCardProps) {
  const [verified, setVerified] = useState(initialVerified);
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    const onVerified = () => setVerified(true);
    window.addEventListener("quill:email-verified", onVerified);
    return () => window.removeEventListener("quill:email-verified", onVerified);
  }, []);

  const handleSendCode = async () => {
    setError("");
    setStatusMsg("");
    setDevCode(null);
    setSending(true);
    try {
      const res = await api.post<{ message: string; devCode?: string }>("/api/auth/verify/send", {});
      setCodeSent(true);
      setStatusMsg(res.message);
      if (res.devCode) {
        setDevCode(res.devCode);
      }
      toast.success("Verification code sent");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not send verification code";
      setError(msg);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStatusMsg("");

    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    setVerifying(true);
    try {
      await api.post<{ message: string; email_verified: boolean }>("/api/auth/verify", {
        code: trimmed,
      });
      setVerified(true);
      setCode("");
      setDevCode(null);
      window.dispatchEvent(new CustomEvent("quill:email-verified"));
      toast.success("Email verified!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not verify code";
      setError(msg);
      toast.error(msg);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div id="verify-email" className="bg-card border border-border rounded-[10px] p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <h3 className="font-semibold text-foreground text-base flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" />
          Email verification
        </h3>
        {verified ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3.5 h-3.5" />
            Verified
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            Unverified
          </span>
        )}
      </div>

      {verified ? (
        <p className="text-sm text-muted-foreground">
          Your email (<span className="font-medium text-foreground">{email}</span>) is verified. You can create and join study groups.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Verify <span className="font-medium text-foreground">{email}</span> with a 6-digit code to unlock creating and joining study groups.
          </p>

          {error && (
            <div role="alert" className="p-3 bg-destructive/10 border border-destructive/20 rounded-[10px] text-sm text-destructive">
              {error}
            </div>
          )}

          {statusMsg && (
            <div className="p-3 bg-muted border border-border rounded-[10px] text-sm text-foreground space-y-1">
              <p>{statusMsg}</p>
              {devCode && (
                <p className="text-xs text-muted-foreground">
                  Dev mode code: <span className="font-mono font-semibold text-foreground">{devCode}</span>
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              type="button"
              onClick={handleSendCode}
              disabled={sending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-[10px] hover:opacity-90 transition-standard cursor-pointer disabled:opacity-50"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : codeSent ? (
                "Resend code"
              ) : (
                "Send verification code"
              )}
            </button>
          </div>

          <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-2 pt-1">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              aria-label="6-digit verification code"
              placeholder="Enter 6-digit code"
              className="w-full sm:max-w-[200px] px-3 py-2 border border-border rounded-[10px] text-sm bg-background text-foreground font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={verifying || code.length !== 6}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-border bg-card text-foreground text-sm font-semibold rounded-[10px] hover:bg-muted transition-standard cursor-pointer disabled:opacity-50"
            >
              {verifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify email"
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
