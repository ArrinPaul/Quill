"use client";

import { useEffect, useState } from "react";
import { Calendar as CalendarDays, ChevronLeft, ChevronRight } from "@untitledui/icons";
import { api } from "@/lib/api";
import type { Task } from "@/features/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface CalendarItem {
  id: string;
  title: string;
  date: Date;
  type: "task";
  status?: string;
  subject?: string;
}

export function MonthlyCalendarWidget() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load tasks
        const taskRes = await api
          .get<{ tasks: Task[] }>("/api/tasks")
          .catch(() => ({ tasks: [] }));
        setTasks(taskRes.tasks || []);

      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const isToday = (day: number) =>
    today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;

  const isSelected = (day: number) =>
    selectedDate &&
    selectedDate.getDate() === day &&
    selectedDate.getMonth() === month &&
    selectedDate.getFullYear() === year;

  const getItemsForDay = (day: number, targetMonth = month, targetYear = year): CalendarItem[] => {
    const dayDate = new Date(targetYear, targetMonth, day);
    dayDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(dayDate);
    nextDay.setDate(dayDate.getDate() + 1);

    // Local tasks
    const taskItems: CalendarItem[] = tasks
      .filter((t) => {
        const d = new Date(t.deadline);
        return d >= dayDate && d < nextDay;
      })
      .map((t) => ({
        id: t.id,
        title: t.title,
        date: new Date(t.deadline),
        type: "task" as const,
        status: t.status,
        subject: t.subject,
      }));

    return taskItems;
  };

  const getSelectedDayItems = (): CalendarItem[] => {
    if (!selectedDate) return [];
    return getItemsForDay(selectedDate.getDate(), selectedDate.getMonth(), selectedDate.getFullYear());
  };

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

  const selectedItems = getSelectedDayItems();

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-[10px] p-5 h-full">
        <div className="h-4 bg-muted rounded animate-pulse w-1/3 mb-4" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-[10px] p-5 card-hover h-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-[10px] bg-primary/10 flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground text-sm">Calendar</h3>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={(e) => { e.stopPropagation(); prevMonth(); }} className="p-1.5 rounded-[10px] hover:bg-muted transition-colors" aria-label="Previous month">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-medium text-foreground px-2 min-w-[110px] text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button type="button" onClick={(e) => { e.stopPropagation(); nextMonth(); }} className="p-1.5 rounded-[10px] hover:bg-muted transition-colors" aria-label="Next month">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-[10px] overflow-hidden mb-4">
        {DAY_NAMES.map((day) => (
          <div key={day} className="bg-muted/50 py-1.5 text-center text-xs font-semibold text-muted-foreground uppercase">
            {day}
          </div>
        ))}

        {calendarDays.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="bg-card min-h-[48px]" />;
          }

          const dayItems = getItemsForDay(day);

          return (
            <button
              key={day}
              type="button"
              aria-label={`${MONTH_NAMES[month]} ${day}, ${year}`}
              aria-pressed={Boolean(isSelected(day))}
              onClick={(e) => { e.stopPropagation(); setSelectedDate(new Date(year, month, day)); }}
              className={`relative bg-card min-h-[48px] p-1 transition-colors hover:bg-primary/5 ${
                isSelected(day) ? "bg-primary/10" : ""
              }`}
            >
              <span
                className={`text-xs font-medium block text-left ${
                  isToday(day)
                    ? "bg-primary text-white w-5 h-5 rounded-full flex items-center justify-center -ml-0.5 -mt-0.5"
                    : "text-foreground"
                }`}
              >
                {day}
              </span>
              {dayItems.length > 0 && <div className="w-full h-1 rounded-full bg-primary mt-0.5" />}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </p>
          {selectedItems.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No events</p>
          ) : (
            <div className="space-y-1.5">
              {selectedItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-2 p-2 rounded-[10px] text-xs ${
                    item.status === "completed" ? "bg-emerald-50" : "bg-primary/5"
                  }`}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      item.status === "completed" ? "bg-emerald-500" : "bg-primary"
                    }`}
                  />
                  <span
                    className={`font-medium truncate ${
                      item.status === "completed" ? "text-emerald-700 line-through" : "text-foreground"
                    }`}
                  >
                    {item.title}
                  </span>
                  <span className="ml-auto text-muted-foreground flex-shrink-0">
                    {item.subject}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
