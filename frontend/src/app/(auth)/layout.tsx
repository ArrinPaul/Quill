"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Bell01 as Bell, CalendarCheck01 as CalendarClock, CheckCircle } from "@untitledui/icons";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && user && (pathname === "/login" || pathname === "/signup")) router.replace("/dashboard");
  }, [loading, user, pathname, router]);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      <div className="lg:hidden flex items-center justify-between px-6 py-4 bg-primary text-white">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/logo-quill.png" alt="Quill Logo" className="w-8 h-8 object-contain" />
          <span className="text-xl font-bold tracking-tight">Quill</span>
        </Link>
        <Link href="/" className="text-xs font-medium text-white/80 hover:text-white">
          Back to home
        </Link>
      </div>
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-primary/80 p-12 flex-col justify-center">
        <div className="max-w-md">
          <Link href="/" className="inline-flex items-center gap-3 mb-8 group">
            <img src="/logo-quill.png" alt="Quill Logo" className="w-16 h-16 object-contain drop-shadow-md transition-transform group-hover:scale-105" />
            <span className="text-4xl font-bold text-white" style={{ letterSpacing: "-0.03em" }}>Quill</span>
          </Link>
          <h1 className="text-3xl font-bold text-white mb-4" style={{ letterSpacing: "-0.03em" }}>
            Your AI-Powered Student Hub
          </h1>
          <p className="text-white/85 mb-8 text-sm leading-relaxed">
            Never miss a deadline again. Deadline tracking, AI summaries, and attendance tracking — all in one place.
          </p>
          <div className="space-y-4">
            {[
              { icon: CalendarClock, text: "Deadline tracking & calendar view" },
              { icon: CheckCircle, text: "AI notice summarization" },
              { icon: Bell, text: "Attendance risk alerts" },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[10px] bg-white/15 flex items-center justify-center">
                  <item.icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm text-white/90">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="w-full lg:w-1/2 flex-1 flex items-center justify-center p-6 sm:p-8 bg-muted/30">
        <div className="w-full max-w-[420px]">
          {children}
        </div>
      </div>
    </div>
  );
}
