"use client";

import { useEffect, useState } from "react";
import { Loading01 as Loader2 } from "@untitledui/icons";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { parseDateOnly } from "@/features/calendar/lib/dates";

interface Report {
  range: number;
  tasks: { completed: number; onTimeRate: number | null; perWeek: { week: string; value: number }[] };
  quizzes: { title: string; score: number; date: string }[];
  attendance: { subject: string; percentage: number; threshold: number }[];
  focus: { totalMinutes: number; perWeek: { week: string; value: number }[] };
}

const RANGES = [7, 30, 90] as const;

const shortDate = (value: Date) => value.toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** A chart with the same numbers available as a table. */
function ChartCard({
  title,
  unit,
  max,
  rows,
}: {
  title: string;
  unit: string;
  /** Fixed top of the scale, for percentages. */
  max?: number;
  rows: { key: string; label: string; value: number }[];
}) {
  const empty = rows.every((r) => r.value === 0);
  return (
    <section aria-label={title} className="rounded-xl border border-border bg-card p-4 min-w-0">
      <h2 className="font-semibold text-foreground mb-3">{title}</h2>
      {empty ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Nothing recorded in this period.</p>
      ) : (
        <>
          <div aria-hidden="true" className="h-56 text-muted-foreground">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.2} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "currentColor" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: "currentColor" }} allowDecimals={false} domain={max ? [0, max] : undefined} />
                <Tooltip
                  cursor={{ fill: "currentColor", opacity: 0.08 }}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--card-foreground))" }}
                />
                <Bar dataKey="value" name={unit} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <details className="mt-2">
            <summary className="text-xs font-medium text-muted-foreground cursor-pointer">Show as table</summary>
            <table className="mt-2 w-full text-sm text-foreground">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-1">Item</th>
                  <th scope="col" className="py-1 text-right">{unit}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-t border-border">
                    <td className="py-1">{r.label}</td>
                    <td className="py-1 text-right">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}

export function ReportsView() {
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  // Kept with the range it answers, so an older response is never shown for a new range.
  const [result, setResult] = useState<{ range: number; report?: Report; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get<Report>(`/api/reports/me?range=${range}&tzOffset=${new Date().getTimezoneOffset()}`)
      .then((report) => !cancelled && setResult({ range, report }))
      .catch((err) => {
        if (!cancelled) setResult({ range, error: err instanceof Error ? err.message : "Could not load the report." });
      });
    return () => {
      cancelled = true;
    };
  }, [range, attempt]);

  const current = result?.range === range ? result : null;
  const report = current?.report;
  const weekRows = (rows: { week: string; value: number }[]) =>
    rows.map((r) => ({ key: r.week, label: shortDate(parseDateOnly(r.week)), value: r.value }));

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <div role="group" aria-label="Period" className="flex rounded-[10px] border border-border bg-card p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-[8px] cursor-pointer",
                range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r} days
            </button>
          ))}
        </div>
      </div>

      {current?.error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {current.error}
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setAttempt((n) => n + 1);
            }}
            className="px-3 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs font-semibold cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {!current && (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}

      {report && (
        <>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              ["Tasks completed", String(report.tasks.completed)],
              ["Finished on time", report.tasks.onTimeRate === null ? "No data" : `${report.tasks.onTimeRate}%`],
              ["Focus time", `${(report.focus.totalMinutes / 60).toFixed(1)} h`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-card p-4">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-2xl font-bold text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            <ChartCard title="Tasks completed per week" unit="Tasks" rows={weekRows(report.tasks.perWeek)} />
            <ChartCard title="Focus minutes per week" unit="Minutes" rows={weekRows(report.focus.perWeek)} />
            <ChartCard
              title="Quiz scores"
              unit="Score"
              max={100}
              rows={report.quizzes.map((q, i) => ({ key: `${i}`, label: `${q.title} (${shortDate(new Date(q.date))})`, value: q.score }))}
            />
            <ChartCard
              title="Attendance by subject (to date)"
              unit="Percent"
              max={100}
              rows={report.attendance.map((a) => ({ key: a.subject, label: a.subject, value: a.percentage }))}
            />
          </div>
        </>
      )}
    </div>
  );
}
