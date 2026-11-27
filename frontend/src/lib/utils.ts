import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Calendar days from today to the deadline; -1 once the deadline has passed. */
export function daysUntil(deadline: string, now = new Date()): number {
  const due = new Date(deadline);
  if (due.getTime() < now.getTime()) return -1;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(due) - startOfDay(now)) / 86_400_000);
}
