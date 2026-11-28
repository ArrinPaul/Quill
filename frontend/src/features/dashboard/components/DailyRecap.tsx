"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { XClose as X } from "@untitledui/icons";
import { api } from "@/lib/api";
import { dateKey } from "@/features/calendar/lib/dates";
import { WorkloadNotice } from "@/features/tasks/components/WorkloadNotice";
import type { Attendance, Task } from "@/features/types";
import { buildRecap } from "../lib/recap";

const DISMISS_KEY = "Quill_recap_dismissed";

type Decks = Parameters<typeof buildRecap>[2];

function dismissedToday() {
  try {
    return localStorage.getItem(DISMISS_KEY) === dateKey(new Date());
  } catch {
    return false;
  }
}

function TaskLine({ label, tasks }: { label: string; tasks: Task[] }) {
  return (
    <div className="min-w-0">
      <h3 className="text-xs font-semibold text-muted-foreground mb-1">
        {label} ({tasks.length})
      </h3>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">None</p>
      ) : (
        <ul className="space-y-0.5">
          {tasks.slice(0, 3).map((t) => (
            <li key={t.id} className="truncate">
              <Link href={`/dashboard/tasks?open=${t.id}`} className="text-sm text-foreground hover:underline">
                {t.title}
              </Link>
            </li>
          ))}
          {tasks.length > 3 && <li className="text-xs text-muted-foreground">+{tasks.length - 3} more</li>}
        </ul>
      )}
    </div>
  );
}

/** Today at a glance. Mounted after the dashboard has loaded its tasks and attendance. */
export function DailyRecap({ tasks, attendance }: { tasks: Task[]; attendance: Attendance[] }) {
  const [hidden, setHidden] = useState(dismissedToday);
  // null until loaded, "failed" if the request did not work
  const [decks, setDecks] = useState<Decks | "failed" | null>(null);

  useEffect(() => {
    api
      .get<{ decks: Decks }>("/api/flashcards/decks")
      .then((res) => setDecks(res.decks || []))
      .catch(() => setDecks("failed"));
  }, []);

  const recap = buildRecap(tasks, attendance, Array.isArray(decks) ? decks : []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, dateKey(new Date()));
    } catch {}
    setHidden(true);
  };

  return (
    <div className="space-y-3">
      <WorkloadNotice tasks={tasks} />
      {!hidden && (
        <section aria-label="Daily recap" className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-semibold text-foreground">Today at a glance</h2>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Hide recap until tomorrow"
              title="Hide until tomorrow"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <TaskLine label="Overdue" tasks={recap.overdue} />
            <TaskLine label="Due today" tasks={recap.dueToday} />
            <TaskLine label="Coming next" tasks={recap.next} />
          </div>
          <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <Link href="/dashboard/attendance" className="hover:underline">
              {recap.lowAttendance.length === 0
                ? "No subject below its attendance target"
                : `Below attendance target: ${recap.lowAttendance
                    .map((a) => `${a.subject} ${Math.floor(a.percentage)}%`)
                    .join(", ")}`}
            </Link>
            <Link href="/dashboard/flashcards" className="hover:underline">
              Flashcards due:{" "}
              {Array.isArray(decks) ? recap.cardsDue : decks === "failed" ? "unavailable" : "…"}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
