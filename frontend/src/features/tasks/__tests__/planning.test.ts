import { describe, expect, it } from "vitest";
import { buildRecap } from "@/features/dashboard/lib/recap";
import type { Attendance, Task, TaskStatus } from "@/features/types";
import { groupByColumn } from "../lib/board";
import { heavyPeriods } from "../lib/workload";

// Monday 30 November 2026, 10:00 local
const NOW = new Date(2026, 10, 30, 10, 0);
const at = (month: number, day: number, hour = 18) => new Date(2026, month, day, hour).toISOString();
let seq = 0;
const task = (deadline: string, status: TaskStatus = "pending") => {
  seq += 1;
  return { id: String(seq), title: `t${seq}`, subject: "s", deadline, status } as Task;
};

describe("board", () => {
  it("drops cancelled tasks and orders by priority then deadline", () => {
    const later = task(at(11, 20));
    const urgent = task(at(10, 30));
    const columns = groupByColumn([later, urgent, task(at(10, 30), "cancelled")], NOW);
    expect(columns.pending.map((t) => t.id)).toEqual([urgent.id, later.id]);
    expect(columns.in_progress).toHaveLength(0);
    expect(columns.completed).toHaveLength(0);
  });
});

describe("workload", () => {
  it("flags a day at 3 open tasks, not at 2, and ignores closed tasks", () => {
    expect(heavyPeriods([task(at(11, 2)), task(at(11, 2))], NOW)).toEqual([]);
    const tasks = [
      task(at(11, 2)),
      task(at(11, 2)),
      task(at(11, 2), "completed"),
      task(at(11, 2), "cancelled"),
    ];
    expect(heavyPeriods(tasks, NOW)).toEqual([]);
    expect(heavyPeriods([...tasks, task(at(11, 2), "in_progress")], NOW)).toEqual([
      { kind: "day", start: "2026-12-02", count: 3 },
    ]);
  });

  it("flags a Monday to Sunday week at 6", () => {
    const five = [1, 2, 3, 4, 6].map((d) => task(at(11, d)));
    expect(heavyPeriods([task(at(10, 30)), ...five], NOW)).toEqual([
      { kind: "week", start: "2026-11-30", count: 6 },
    ]);
    // the sixth falls on the following Monday
    expect(heavyPeriods([...five, task(at(11, 7))], NOW)).toEqual([]);
  });

  it("ignores days that have passed", () => {
    const past = [task(at(10, 20)), task(at(10, 20)), task(at(10, 20))];
    expect(heavyPeriods(past, NOW)).toEqual([]);
  });
});

describe("recap", () => {
  it("splits overdue, today and next, and lists low attendance and due cards", () => {
    const overdue = task(at(10, 29));
    const earlierToday = task(at(10, 30, 8));
    const today = task(at(10, 30, 23));
    const soon = [1, 2, 3, 4].map((d) => task(at(11, d)));
    const recap = buildRecap(
      [
        ...soon,
        today,
        earlierToday,
        overdue,
        task(at(10, 30), "completed"),
        task(at(10, 30), "cancelled"),
      ],
      [
        { subject: "Low", total_classes: 10, attended_classes: 7, threshold: 75 },
        { subject: "Fine", total_classes: 4, attended_classes: 3, threshold: 75 },
        { subject: "None", total_classes: 0, attended_classes: 0, threshold: 75 },
      ] as Attendance[],
      [{ flashcards: [{ next_review_at: null }, { next_review_at: at(11, 9) }] }],
      NOW
    );
    expect(recap.overdue.map((t) => t.id)).toEqual([overdue.id, earlierToday.id]);
    expect(recap.dueToday.map((t) => t.id)).toEqual([today.id]);
    expect(recap.next.map((t) => t.id)).toEqual(soon.slice(0, 3).map((t) => t.id));
    expect(recap.lowAttendance.map((a) => a.subject)).toEqual(["Low"]);
    expect(recap.cardsDue).toBe(1);
  });
});
