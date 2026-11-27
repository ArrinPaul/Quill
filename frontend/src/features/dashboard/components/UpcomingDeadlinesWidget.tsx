"use client";

import Link from "next/link";
import { ArrowRight, Clock, Plus, Stars01 as PartyPopper, Calendar } from "@untitledui/icons";
import type { Task } from "@/features/types";
import { generateGoogleCalendarUrl } from "@/lib/calendar";
import { daysUntil } from "@/lib/utils";
import { sortTasksByPriority } from "@/lib/priority";
import { PriorityBadge } from "@/features/tasks/components/PriorityBadge";
import { usePrioritySort } from "@/features/tasks/hooks/usePrioritySort";

interface UpcomingDeadlinesWidgetProps {
  tasks: Task[];
}

const getDaysLeft = (deadline: string) => daysUntil(deadline);

function getDaysLabel(days: number): string {
  if (days < 0) return "Overdue";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days} days`;
}

function getDaysColor(days: number): string {
  if (days < 0) return "bg-destructive/10 text-destructive";
  if (days <= 2) return "bg-orange-50 text-orange-600";
  if (days <= 5) return "bg-yellow-50 text-yellow-700";
  return "bg-emerald-50 text-emerald-600";
}

export function UpcomingDeadlinesWidget({ tasks = [] }: UpcomingDeadlinesWidgetProps) {
  const { sortByPriority, toggleSortByPriority } = usePrioritySort("quill.dashboard.sortByPriority");
  const upcomingTasks = tasks.filter((task) => {
    if (task.status === "completed" || task.status === "cancelled") return false;
    const days = daysUntil(task.deadline);
    return days >= 0 && days <= 7;
  });
  const displayedTasks = sortByPriority ? sortTasksByPriority(upcomingTasks) : upcomingTasks;

  return (
    <div className="bg-card border border-border rounded-[10px] p-5 card-hover h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-primary/10 flex items-center justify-center">
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground">Upcoming Deadlines</h3>
        </div>
        <div className="flex items-center gap-2">
          {upcomingTasks.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleSortByPriority();
              }}
              aria-pressed={sortByPriority}
              className={`px-2 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                sortByPriority
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              Sort by priority
            </button>
          )}
          {upcomingTasks.length > 0 && (
            <Link href="/dashboard/tasks" onClick={(e) => e.stopPropagation()} className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>

      {upcomingTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
            <PartyPopper className="w-6 h-6 text-emerald-500" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No upcoming deadlines</p>
          <p className="text-xs text-muted-foreground mb-4">You&apos;re all caught up! Keep it up.</p>
          <Link
            href="/dashboard/tasks"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-medium rounded-[10px] hover:bg-primary/90 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Add Reminder
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {displayedTasks.slice(0, 5).map((task) => {
            const days = getDaysLeft(task.deadline);
            return (
              <div
                key={task.id}
                className="flex items-center justify-between gap-2 p-3 bg-muted/50 hover:bg-muted rounded-[10px] transition-colors"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">{task.subject}</span>
                    <PriorityBadge task={task} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={generateGoogleCalendarUrl(task.title, task.description || "", task.deadline)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 hover:bg-blue-50 rounded-md text-muted-foreground hover:text-blue-600 transition-colors"
                    title="Add to Google Calendar"
                    aria-label={`Add ${task.title} to Google Calendar`}
                  >
                    <Calendar className="w-4 h-4" />
                  </a>
                  <span className={`ml-2 px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap ${getDaysColor(days)}`}>
                    {getDaysLabel(days)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
