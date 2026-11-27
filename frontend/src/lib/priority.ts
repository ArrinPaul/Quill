import type { TaskImportance, TaskStatus } from "@/features/types";
import { daysUntil } from "@/lib/utils";

export type PriorityLevel = "High" | "Medium" | "Low";

export interface TaskPriority {
  level: PriorityLevel;
  score: number;
  reason: string;
}

export interface PrioritizableTask {
  deadline: string;
  status: TaskStatus;
  importance?: TaskImportance | null;
}

const IMPORTANCE_DELTA: Record<TaskImportance, number> = {
  high: 25,
  normal: 0,
  low: -15,
};

/** Computes deterministic rule-based priority from deadline urgency and task importance. */
export function priorityOf(task: PrioritizableTask, now = new Date()): TaskPriority | null {
  if (task.status === "completed" || task.status === "cancelled") {
    return null;
  }

  const days = daysUntil(task.deadline, now);

  let baseScore: number;
  let baseReason: string;
  if (days < 0) {
    baseScore = 100;
    baseReason = "Overdue";
  } else if (days === 0) {
    baseScore = 80;
    baseReason = "Due today";
  } else if (days === 1) {
    baseScore = 70;
    baseReason = "Due tomorrow";
  } else if (days <= 3) {
    baseScore = 50;
    baseReason = `Due in ${days} days`;
  } else if (days <= 7) {
    baseScore = 30;
    baseReason = `Due in ${days} days`;
  } else {
    baseScore = 10;
    baseReason = `Due in ${days} days`;
  }

  const importance: TaskImportance = task.importance ?? "normal";
  const score = baseScore + IMPORTANCE_DELTA[importance];
  const level: PriorityLevel = score >= 70 ? "High" : score >= 40 ? "Medium" : "Low";
  const reason = importance === "high" ? `${baseReason} · marked important` : baseReason;

  return { level, score, reason };
}

/** Sorts tasks by descending priority score (completed/cancelled last), breaking ties by earlier deadline. */
export function sortTasksByPriority<T extends PrioritizableTask>(tasks: T[], now = new Date()): T[] {
  return [...tasks].sort((a, b) => {
    const pa = priorityOf(a, now);
    const pb = priorityOf(b, now);
    if (pa && !pb) return -1;
    if (!pa && pb) return 1;
    if (pa && pb && pa.score !== pb.score) return pb.score - pa.score;
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
  });
}
