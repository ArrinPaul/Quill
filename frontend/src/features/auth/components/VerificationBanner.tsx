"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, XClose as X } from "@untitledui/icons";
import { useAuth } from "@/hooks/useAuth";

export function VerificationBanner() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [verifiedLocally, setVerifiedLocally] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onVerified = () => setVerifiedLocally(true);
    window.addEventListener("quill:email-verified", onVerified);
    return () => window.removeEventListener("quill:email-verified", onVerified);
  }, []);

  const emailVerified = (user as { email_verified?: boolean } | null)?.email_verified;
  if (!user || emailVerified !== false || verifiedLocally || dismissed || pathname === "/dashboard/settings") {
    return null;
  }

  return (
    <div
      role="status"
      className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-[10px] border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
    >
      <div className="flex items-start sm:items-center gap-2.5 min-w-0">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 sm:mt-0" />
        <p className="text-xs sm:text-sm">
          Verify your email (<span className="font-medium">{user.email}</span>) to create or join study groups.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        <Link
          href="/dashboard/settings#verify-email"
          className="px-3 py-1.5 rounded-[10px] bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-standard"
        >
          Verify email
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss verification reminder"
          className="p-1.5 rounded-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-standard cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
