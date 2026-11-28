import { describe, expect, it } from "vitest";
import {
  addMonths,
  dateKey,
  monthGrid,
  parseDateOnly,
  startOfWeekMonday,
  weekGrid,
} from "../lib/dates";

describe("calendar dates", () => {
  it("reads a date-only string as that local day", () => {
    const d = parseDateOnly("2026-03-01");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 2, 1]);
  });

  it("covers whole weeks around a month", () => {
    const days = monthGrid(new Date(2026, 10, 15));
    expect(days.length % 7).toBe(0);
    expect(dateKey(days[0])).toBe("2026-11-01");
    expect(dateKey(days[days.length - 1])).toBe("2026-12-05");
  });

  it("includes 29 February only in a leap year", () => {
    expect(monthGrid(new Date(2028, 1, 1)).map(dateKey)).toContain("2028-02-29");
    expect(monthGrid(new Date(2027, 1, 1)).map(dateKey)).not.toContain("2027-02-29");
  });

  it("does not skip a month when stepping from the 31st", () => {
    expect(dateKey(addMonths(new Date(2027, 0, 31), 1))).toBe("2027-02-01");
    expect(dateKey(addMonths(new Date(2026, 11, 31), 1))).toBe("2027-01-01");
  });

  it("builds weeks across a year end", () => {
    const week = weekGrid(new Date(2026, 11, 31)).map(dateKey);
    expect(week[0]).toBe("2026-12-27");
    expect(week[6]).toBe("2027-01-02");
    expect(dateKey(startOfWeekMonday(new Date(2027, 0, 3)))).toBe("2026-12-28");
  });
});
