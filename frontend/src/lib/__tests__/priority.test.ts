import { describe, expect, it } from "vitest";
import { priorityOf } from "../priority";
import type { TaskImportance } from "@/features/types";

const NOW = new Date(2026, 10, 27, 10, 0, 0);

function deadlineForDays(days: number): string {
  if (days < 0) {
    return new Date(2026, 10, 27 + days, 10, 0, 0).toISOString();
  }
  if (days === 0) {
    return new Date(2026, 10, 27, 18, 0, 0).toISOString();
  }
  return new Date(2026, 10, 27 + days, 18, 0, 0).toISOString();
}

describe("priorityOf", () => {
  it("returns null for completed and cancelled tasks", () => {
    expect(
      priorityOf({ deadline: deadlineForDays(-1), status: "completed", importance: "high" }, NOW),
    ).toBeNull();
    expect(
      priorityOf({ deadline: deadlineForDays(0), status: "cancelled", importance: "normal" }, NOW),
    ).toBeNull();
  });

  const cases: Array<{
    days: number;
    importance: TaskImportance;
    score: number;
    level: "High" | "Medium" | "Low";
    reason: string;
  }> = [
    { days: -1, importance: "low", score: 85, level: "High", reason: "Overdue" },
    { days: -1, importance: "normal", score: 100, level: "High", reason: "Overdue" },
    { days: -1, importance: "high", score: 125, level: "High", reason: "Overdue · marked important" },

    { days: 0, importance: "low", score: 65, level: "Medium", reason: "Due today" },
    { days: 0, importance: "normal", score: 80, level: "High", reason: "Due today" },
    { days: 0, importance: "high", score: 105, level: "High", reason: "Due today · marked important" },

    { days: 1, importance: "low", score: 55, level: "Medium", reason: "Due tomorrow" },
    { days: 1, importance: "normal", score: 70, level: "High", reason: "Due tomorrow" },
    { days: 1, importance: "high", score: 95, level: "High", reason: "Due tomorrow · marked important" },

    { days: 3, importance: "low", score: 35, level: "Low", reason: "Due in 3 days" },
    { days: 3, importance: "normal", score: 50, level: "Medium", reason: "Due in 3 days" },
    { days: 3, importance: "high", score: 75, level: "High", reason: "Due in 3 days · marked important" },

    { days: 4, importance: "low", score: 15, level: "Low", reason: "Due in 4 days" },
    { days: 4, importance: "normal", score: 30, level: "Low", reason: "Due in 4 days" },
    { days: 4, importance: "high", score: 55, level: "Medium", reason: "Due in 4 days · marked important" },

    { days: 7, importance: "low", score: 15, level: "Low", reason: "Due in 7 days" },
    { days: 7, importance: "normal", score: 30, level: "Low", reason: "Due in 7 days" },
    { days: 7, importance: "high", score: 55, level: "Medium", reason: "Due in 7 days · marked important" },

    { days: 8, importance: "low", score: -5, level: "Low", reason: "Due in 8 days" },
    { days: 8, importance: "normal", score: 10, level: "Low", reason: "Due in 8 days" },
    { days: 8, importance: "high", score: 35, level: "Low", reason: "Due in 8 days · marked important" },
  ];

  it.each(cases)(
    "computes $level ($score) for days=$days and importance=$importance",
    ({ days, importance, score, level, reason }) => {
      const result = priorityOf(
        { deadline: deadlineForDays(days), status: "pending", importance },
        NOW,
      );
      expect(result).toEqual({ level, score, reason });
    },
  );
});
