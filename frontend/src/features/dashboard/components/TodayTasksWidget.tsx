"use client";

import Link from "next/link";
import { ArrowRight, CalendarCheck01 as CalendarClock, Calendar, Clipboard as ClipboardList, Plus } from "@untitledui/icons";
import type { Task } from "@/features/types";
import { motion } from "framer-motion";
import { generateGoogleCalendarUrl } from "@/lib/calendar";
import { sortTasksByPriority } from "@/lib/priority";
import { PriorityBadge } from "@/features/tasks/components/PriorityBadge";
import { usePrioritySort } from "@/features/tasks/hooks/usePrioritySort";

interface TodayTasksWidgetProps {
  tasks: Task[];
}

const listVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const itemVariants = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0 }
};

export function TodayTasksWidget({ tasks = [] }: TodayTasksWidgetProps) {
  const { sortByPriority, toggleSortByPriority } = usePrioritySort("quill.dashboard.sortByPriority");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayTasks = tasks.filter((task) => {
    const taskDate = new Date(task.deadline);
    return taskDate >= today && taskDate < tomorrow;
  });
  const displayedTasks = sortByPriority ? sortTasksByPriority(todayTasks) : todayTasks;

  return (
    <div className="bg-card border border-border rounded-[10px] p-5 card-hover h-full flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-primary/10 flex items-center justify-center">
            <CalendarClock className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground">Today&apos;s Tasks</h3>
        </div>
        <div className="flex items-center gap-2">
          {todayTasks.length > 1 && (
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
          {todayTasks.length > 0 && (
            <Link href="/dashboard/tasks" onClick={(e) => e.stopPropagation()} className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>

      {todayTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <ClipboardList className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No tasks due today</p>
          <p className="text-xs text-muted-foreground mb-4">Enjoy your free day!</p>
          <Link
            href="/dashboard/tasks"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-medium rounded-[10px] hover:bg-primary/90 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Add Task
          </Link>
        </div>
      ) : (
        <motion.div 
          variants={listVariants}
          initial="hidden"
          animate="show"
          className="space-y-2 flex-1"
        >
          {displayedTasks.slice(0, 5).map((task) => (
            <motion.div
              key={task.id}
              variants={itemVariants}
              whileHover={{ scale: 1.01, x: 4 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="flex items-center justify-between gap-2 p-3 bg-muted/50 hover:bg-muted rounded-[10px] transition-colors"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">{task.subject}</span>
                  {task.status === "in_progress" && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      In progress
                    </span>
                  )}
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
                <span className="px-2.5 py-1 text-xs font-medium bg-primary/10 text-primary rounded-[10px] whitespace-nowrap capitalize">
                  {task.status}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
