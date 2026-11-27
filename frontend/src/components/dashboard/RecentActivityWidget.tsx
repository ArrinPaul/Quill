"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Announcement01 as Megaphone,
  CheckCircle,
  HelpCircle,
  LayersTwo01 as Layers,
  List as ListTodo,
  PenTool01 as PenTool,
  RefreshCw01 as RefreshCw,
} from "@untitledui/icons";
import { api } from "@/lib/api";
import type { ActivityItem, ActivityType } from "@/features/types";

interface ActivityMeta {
  icon: typeof CheckCircle;
  verb: string;
  href: string;
  color: string;
  bg: string;
}

const activityMeta: Record<ActivityType, ActivityMeta> = {
  task_created: {
    icon: ListTodo,
    verb: "Created task",
    href: "/dashboard/tasks",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  task_completed: {
    icon: CheckCircle,
    verb: "Completed task",
    href: "/dashboard/tasks",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  notice_added: {
    icon: Megaphone,
    verb: "Added notice",
    href: "/dashboard/notices",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
  quiz_completed: {
    icon: HelpCircle,
    verb: "Completed quiz",
    href: "/dashboard/quiz",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10",
  },
  deck_created: {
    icon: Layers,
    verb: "Created deck",
    href: "/dashboard/flashcards",
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-500/10",
  },
  board_created: {
    icon: PenTool,
    verb: "Created board",
    href: "/dashboard/whiteboard",
    color: "text-primary",
    bg: "bg-primary/10",
  },
};

const fallbackMeta: ActivityMeta = {
  icon: CheckCircle,
  verb: "Activity",
  href: "/dashboard",
  color: "text-muted-foreground",
  bg: "bg-muted",
};

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = Math.max(0, now - then);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RecentActivityWidget() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ items: ActivityItem[] }>("/api/activity/recent")
      .then((res) => {
        if (!cancelled) {
          setItems(res.items || []);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load recent activity");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-[10px] p-5 h-full">
        <div className="h-4 bg-muted rounded animate-pulse w-1/3 mb-4" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 bg-muted rounded animate-pulse mb-2" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card border border-border rounded-[10px] p-5 h-full">
        <h3 className="font-semibold text-foreground text-sm mb-4">Recent Activity</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm font-medium text-foreground mb-1">Could not load recent activity</p>
          <p className="text-xs text-muted-foreground mb-4">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-card border border-border rounded-[10px] p-5 card-hover h-full">
        <h3 className="font-semibold text-foreground text-sm mb-4">Recent Activity</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
            <CheckCircle className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No activity yet</p>
          <p className="text-xs text-muted-foreground">Activity will appear here as you use Quill</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-[10px] p-5 card-hover h-full">
      <h3 className="font-semibold text-foreground text-sm mb-4">Recent Activity</h3>
      <div className="space-y-1">
        {items.slice(0, 6).map((item) => {
          const meta = activityMeta[item.type] || fallbackMeta;
          const Icon = meta.icon;

          return (
            <Link
              key={item.id}
              href={meta.href}
              className="flex items-start gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-muted/60 transition-colors"
            >
              <div className={`w-8 h-8 rounded-[10px] ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${meta.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-snug truncate">
                  <span className="font-medium">{meta.verb}:</span>{" "}
                  <span className="text-muted-foreground">{item.title}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatTimeAgo(item.created_at)}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
