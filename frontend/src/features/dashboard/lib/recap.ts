import { dateKey } from "@/features/calendar/lib/dates";
import { getDueCards } from "@/features/flashcards/lib/studyUtils";
import type { Attendance, Task } from "@/features/types";

export interface Recap {
  overdue: Task[];
  dueToday: Task[];
  next: Task[];
  lowAttendance: { subject: string; percentage: number; threshold: number }[];
  cardsDue: number;
}

export function buildRecap(
  tasks: Task[],
  attendance: Attendance[],
  decks: { flashcards?: { next_review_at?: string | null }[] }[],
  now = new Date()
): Recap {
  const today = dateKey(now);
  const open = tasks
    .filter((t) => t.status === "pending" || t.status === "in_progress")
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
  const overdue = open.filter((t) => new Date(t.deadline) < now);
  const upcoming = open.filter((t) => new Date(t.deadline) >= now);
  const dueToday = upcoming.filter((t) => dateKey(new Date(t.deadline)) === today);

  const lowAttendance = attendance
    .filter((a) => a.total_classes > 0)
    .map((a) => ({
      subject: a.subject,
      percentage: (a.attended_classes / a.total_classes) * 100,
      threshold: a.threshold,
    }))
    .filter((a) => a.percentage < a.threshold);

  return {
    overdue,
    dueToday,
    next: upcoming.filter((t) => !dueToday.includes(t)).slice(0, 3),
    lowAttendance,
    cardsDue: decks.reduce((sum, d) => sum + getDueCards(d.flashcards ?? [], now).length, 0),
  };
}
