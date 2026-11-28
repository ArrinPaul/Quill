import { AlertTriangle } from "@untitledui/icons";
import { parseDateOnly } from "@/features/calendar/lib/dates";
import type { Task } from "@/features/types";
import { heavyPeriods } from "../lib/workload";

const dayLabel = (key: string) =>
  parseDateOnly(key).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

/** Text warning about days and weeks with many open tasks; renders nothing otherwise. */
export function WorkloadNotice({ tasks }: { tasks: Task[] }) {
  const periods = heavyPeriods(tasks);
  if (periods.length === 0) return null;

  return (
    <div
      role="status"
      className="flex gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground"
    >
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
      <div>
        <p className="font-semibold">Heavy workload ahead</p>
        <ul className="text-muted-foreground">
          {periods.slice(0, 4).map((p) => (
            <li key={`${p.kind}-${p.start}`}>
              {p.count} open tasks{" "}
              {p.kind === "day" ? `on ${dayLabel(p.start)}` : `in the week of ${dayLabel(p.start)}`}
            </li>
          ))}
        </ul>
        {periods.length > 4 && (
          <p className="text-muted-foreground">and {periods.length - 4} more</p>
        )}
      </div>
    </div>
  );
}
