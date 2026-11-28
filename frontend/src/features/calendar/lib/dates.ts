/** All calendar maths uses local time, so a day means the same day the student sees. */

const pad = (n: number) => String(n).padStart(2, "0");

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Read "YYYY-MM-DD" as a local date. `new Date(string)` would read it as UTC. */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Move by whole months, landing on the 1st so that 31 January does not skip February. */
export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function startOfWeek(date: Date): Date {
  return addDays(date, -date.getDay());
}

export function startOfWeekMonday(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}

/** Seven days, Sunday first. */
export function weekGrid(date: Date): Date[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Whole weeks (Sunday first) covering the month of `date`. */
export function monthGrid(date: Date): Date[] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const end = addDays(startOfWeek(last), 6);
  const days: Date[] = [];
  for (let d = startOfWeek(first); d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}
