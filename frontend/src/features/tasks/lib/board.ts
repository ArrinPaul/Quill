import { sortTasksByPriority } from "@/lib/priority";
import type { Task, TaskStatus } from "@/features/types";

export const BOARD_COLUMNS = [
  { status: "pending", label: "To do" },
  { status: "in_progress", label: "In progress" },
  { status: "completed", label: "Done" },
] as const;

export type BoardStatus = (typeof BOARD_COLUMNS)[number]["status"];

export function isBoardStatus(value: unknown): value is BoardStatus {
  return BOARD_COLUMNS.some((c) => c.status === value);
}

/** Split tasks into board columns, ordered by priority then deadline. Cancelled tasks are left out. */
export function groupByColumn(tasks: Task[], now = new Date()): Record<BoardStatus, Task[]> {
  const column = (status: TaskStatus) =>
    sortTasksByPriority(
      tasks.filter((t) => t.status === status),
      now
    );
  return {
    pending: column("pending"),
    in_progress: column("in_progress"),
    completed: column("completed"),
  };
}
