"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Loading01 as Loader2,
  Plus,
} from "@untitledui/icons";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Notice, Task } from "@/features/types";
import { TaskModal } from "@/features/tasks/components/TaskModal";
import { WorkloadNotice } from "@/features/tasks/components/WorkloadNotice";
import { addDays, addMonths, dateKey, monthGrid, parseDateOnly, weekGrid } from "../lib/dates";

type View = "month" | "week";

interface Item {
  id: string;
  kind: "task" | "notice";
  title: string;
  done: boolean;
  task?: Task;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function loadCalendar() {
  const [taskRes, noticeRes] = await Promise.all([
    api.get<{ tasks: Task[] }>("/api/tasks"),
    api.get<{ notices: Notice[] }>("/api/notices"),
  ]);
  return {
    tasks: (taskRes.tasks || []).filter((t) => t.status !== "cancelled"),
    notices: noticeRes.notices || [],
  };
}

export function CalendarView() {
  const [data, setData] = useState<{ tasks: Task[]; notices: Notice[] } | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [show, setShow] = useState({ task: true, notice: true });
  const [modal, setModal] = useState<{ task?: Task; day?: Date } | null>(null);

  const latestLoadRef = useRef(0);

  const refresh = useCallback(() => {
    const load = ++latestLoadRef.current;
    loadCalendar()
      .then((next) => {
        if (load !== latestLoadRef.current) return;
        setData(next);
        setError("");
      })
      .catch((err) => {
        if (load !== latestLoadRef.current) return;
        setError(err instanceof Error ? err.message : "Could not load the calendar.");
      });
  }, []);

  useEffect(refresh, [refresh]);

  const byDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    const add = (key: string, item: Item) => map.set(key, [...(map.get(key) ?? []), item]);
    if (show.task) {
      for (const task of data?.tasks ?? []) {
        add(dateKey(new Date(task.deadline)), {
          id: task.id,
          kind: "task",
          title: task.title,
          done: task.status === "completed",
          task,
        });
      }
    }
    if (show.notice) {
      for (const notice of data?.notices ?? []) {
        if (!notice.event_date) continue;
        add(dateKey(parseDateOnly(notice.event_date)), {
          id: notice.id,
          kind: "notice",
          title: notice.event_title || notice.notice_text.slice(0, 60),
          done: false,
        });
      }
    }
    return map;
  }, [data, show]);

  const days = view === "month" ? monthGrid(cursor) : weekGrid(cursor);
  const today = dateKey(new Date());
  const inPeriod = (day: Date) => view === "week" || day.getMonth() === cursor.getMonth();
  const step = (direction: 1 | -1) =>
    setCursor((c) => (view === "month" ? addMonths(c, direction) : addDays(c, 7 * direction)));

  const heading =
    view === "month"
      ? cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : `${days[0].toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;

  const addTaskOn = (day: Date) =>
    setModal({ day: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59) });

  const renderItem = (item: Item) => {
    const className = cn(
      "block w-full truncate rounded px-1.5 py-0.5 text-left text-xs cursor-pointer",
      item.kind === "task" ? "bg-primary/10 text-primary" : "bg-amber-500/15 text-foreground",
      item.done && "line-through opacity-60"
    );
    const label = `${item.kind === "task" ? "Task" : "Notice"}: ${item.title}`;
    return item.task ? (
      <button type="button" onClick={() => setModal({ task: item.task })} className={className} title={label}>
        {item.title}
      </button>
    ) : (
      <Link href={`/dashboard/notices?open=${item.id}`} className={className} title={label}>
        {item.title}
      </Link>
    );
  };

  const agenda = days.filter((d) => inPeriod(d) && byDay.has(dateKey(d)));
  const button =
    "px-3 py-1.5 text-xs font-semibold rounded-[10px] border border-border bg-card text-foreground hover:bg-accent cursor-pointer";

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
        <div role="group" aria-label="Calendar view" className="flex rounded-[10px] border border-border bg-card p-0.5">
          {(["month", "week"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-[8px] capitalize cursor-pointer",
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => step(-1)} aria-label={`Previous ${view}`} className={button}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => step(1)} aria-label={`Next ${view}`} className={button}>
            <ChevronRight className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setCursor(new Date())} className={button}>
            Today
          </button>
          <h2 aria-live="polite" className="text-base font-semibold text-foreground">
            {heading}
          </h2>
        </div>
        <div className="flex items-center gap-4 text-sm text-foreground">
          {(["task", "notice"] as const).map((kind) => (
            <label key={kind} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={show[kind]}
                onChange={(e) => setShow((s) => ({ ...s, [kind]: e.target.checked }))}
                className="accent-primary"
              />
              {kind === "task" ? "Tasks" : "Notices"}
            </label>
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
          <button type="button" onClick={refresh} className={button}>
            Retry
          </button>
        </div>
      )}

      {data && <WorkloadNotice tasks={data.tasks} />}

      {!data && !error ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-muted/40">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = dateKey(day);
              const items = byDay.get(key) ?? [];
              const label = day.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
              return (
                <div
                  key={key}
                  className={cn(
                    "relative min-w-0 border-b border-r border-border p-1 sm:p-1.5",
                    view === "month" ? "min-h-16 sm:min-h-28" : "min-h-40 sm:min-h-72",
                    !inPeriod(day) && "bg-muted/30 opacity-60"
                  )}
                >
                  {/* Covers the whole cell, so any empty space in it adds a task */}
                  <button
                    type="button"
                    onClick={() => addTaskOn(day)}
                    aria-label={`Add task on ${label}${items.length ? `, ${items.length} items` : ""}`}
                    className="absolute inset-0 cursor-pointer hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                  />
                  <span
                    className={cn(
                      "pointer-events-none relative inline-flex w-6 h-6 items-center justify-center rounded-full text-xs",
                      key === today ? "bg-primary text-primary-foreground font-bold" : "text-foreground"
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {items.length > 0 && (
                    <>
                      <span className="pointer-events-none relative block sm:hidden text-center text-[10px] font-semibold text-primary">
                        {items.length}
                      </span>
                      <ul className="relative hidden sm:block space-y-0.5 mt-1">
                        {items.slice(0, view === "month" ? 3 : 20).map((item) => (
                          <li key={`${item.kind}-${item.id}`}>{renderItem(item)}</li>
                        ))}
                        {view === "month" && items.length > 3 && (
                          <li className="text-[10px] text-muted-foreground">+{items.length - 3} more below</li>
                        )}
                      </ul>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data && (
        <section aria-label={`Items this ${view}`} className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">This {view}</h2>
          {agenda.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
          ) : (
            agenda.map((day) => (
              <div key={dateKey(day)} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <h3 className="text-xs font-semibold text-muted-foreground">
                    {day.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
                  </h3>
                  <button
                    type="button"
                    onClick={() => addTaskOn(day)}
                    aria-label={`Add task on ${day.toDateString()}`}
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <ul className="space-y-1">
                  {byDay.get(dateKey(day))!.map((item) => (
                    <li key={`${item.kind}-${item.id}`}>{renderItem(item)}</li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      )}

      {modal && (
        <TaskModal
          key={modal.task?.id ?? "new"}
          task={modal.task}
          defaultDeadline={modal.day}
          onClose={() => setModal(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
