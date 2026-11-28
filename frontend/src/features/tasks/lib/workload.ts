import { dateKey, startOfWeekMonday } from "@/features/calendar/lib/dates";
import type { Task } from "@/features/types";

export const HEAVY_DAY = 3;
export const HEAVY_WEEK = 6;

export interface HeavyPeriod {
  kind: "day" | "week";
  /** First day of the period, as a local YYYY-MM-DD key. */
  start: string;
  count: number;
}

/** Days and Monday-start weeks, from today on, that hold too many open tasks. */
export function heavyPeriods(
  tasks: Pick<Task, "deadline" | "status">[],
  now = new Date()
): HeavyPeriod[] {
  const today = dateKey(now);
  const days = new Map<string, number>();
  const weeks = new Map<string, number>();

  for (const task of tasks) {
    if (task.status !== "pending" && task.status !== "in_progress") continue;
    const due = new Date(task.deadline);
    const day = dateKey(due);
    if (day < today) continue;
    const week = dateKey(startOfWeekMonday(due));
    days.set(day, (days.get(day) ?? 0) + 1);
    weeks.set(week, (weeks.get(week) ?? 0) + 1);
  }

  const heavy = (counts: Map<string, number>, kind: HeavyPeriod["kind"], limit: number) =>
    [...counts]
      .filter(([, count]) => count >= limit)
      .map(([start, count]) => ({ kind, start, count }));

  return [...heavy(days, "day", HEAVY_DAY), ...heavy(weeks, "week", HEAVY_WEEK)].sort((a, b) =>
    a.start.localeCompare(b.start)
  );
}
