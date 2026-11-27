"use client";

import { priorityOf, type PrioritizableTask, type PriorityLevel } from "@/lib/priority";

const LEVEL_STYLES: Record<PriorityLevel, string> = {
  High: "bg-destructive/15 text-destructive border-destructive/30",
  Medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  Low: "bg-muted text-muted-foreground border-border",
};

interface PriorityBadgeProps {
  task: PrioritizableTask;
  showReason?: boolean;
}

/** Displays a text-labeled priority badge and optional rule reason for active tasks. */
export function PriorityBadge({ task, showReason = true }: PriorityBadgeProps) {
  const priority = priorityOf(task);
  if (!priority) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border whitespace-nowrap ${LEVEL_STYLES[priority.level]}`}
      >
        {priority.level} priority
      </span>
      {showReason && (
        <span className="text-xs text-muted-foreground">{priority.reason}</span>
      )}
    </span>
  );
}
