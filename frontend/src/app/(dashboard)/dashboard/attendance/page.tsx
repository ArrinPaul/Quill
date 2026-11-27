"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart01 as BarChart3, CheckCircle, Loading01 as Loader2, Plus, RefreshCcw01 as RefreshCw, Shield02 as ShieldAlert, Stars01 as Sparkles, Trash01 as Trash2 } from "@untitledui/icons";
import { api } from "@/lib/api";
import type { Attendance } from "@/features/types";

interface AIAlert {
  percentage: string;
  message: string;
  isAtRisk: boolean;
}

export default function AttendancePage() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form input states
  const [subject, setSubject] = useState("");
  const [totalClasses, setTotalClasses] = useState<number | "">("");
  const [attendedClasses, setAttendedClasses] = useState<number | "">("");
  const [threshold, setThreshold] = useState<number>(75);

  // AI Alerts state mapped by record ID or subject
  const [aiAlerts, setAiAlerts] = useState<Record<string, AIAlert>>({});
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchAttendance = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await api.get<{ attendance: Attendance[] }>("/api/attendance");
      setRecords(res.attendance || []);
      
      // Auto analyze risk for all loaded records
      res.attendance?.forEach((record) => {
        analyzeRisk(record);
      });
    } catch (err) {
      console.error("Failed to fetch attendance", err);
    } finally {
      setLoading(false);
    }
  };

  const analyzeRisk = async (record: Attendance) => {
    try {
      const alertData = await api.post<AIAlert>("/api/ai/attendance-alert", {
        subject: record.subject,
        total: record.total_classes,
        attended: record.attended_classes,
        threshold: record.threshold
      });
      setAiAlerts((prev) => ({ ...prev, [record.id]: alertData }));
    } catch (err) {
      console.error(`Failed to assess risk for ${record.subject}`, err);
      const pct = record.total_classes > 0 ? Math.round((record.attended_classes / record.total_classes) * 100) : 0;
      setAiAlerts((prev) => ({
        ...prev,
        [record.id]: {
          percentage: String(pct),
          isAtRisk: pct < record.threshold,
          message: "Unable to load AI risk analysis right now. Click refresh to retry.",
        },
      }));
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSuccessMsg("");

    if (!subject.trim() || totalClasses === "" || attendedClasses === "") {
      setFormError("Subject, total classes and attended classes are required");
      return;
    }

    if (Number(attendedClasses) > Number(totalClasses)) {
      setFormError("Attended classes cannot exceed total classes");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post<{ attendance: Attendance }>("/api/attendance", {
        subject: subject.trim(),
        total_classes: Number(totalClasses),
        attended_classes: Number(attendedClasses),
        threshold: Number(threshold)
      });
      
      // Reset form
      setSubject("");
      setTotalClasses("");
      setAttendedClasses("");
      setThreshold(75);
      setSuccessMsg("Attendance record saved!");
      
      // Reload and auto-analyze
      fetchAttendance(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save attendance record");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      await api.delete(`/api/attendance/${id}`);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setAiAlerts((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    } catch (err) {
      console.error("Failed to delete record", err);
    }
  };

  const handleRefreshAlert = async (record: Attendance) => {
    setAnalyzingId(record.id);
    await analyzeRisk(record);
    setAnalyzingId(null);
  };

  const savingIds = useRef(new Set<string>());

  const handleQuickUpdate = async (record: Attendance, type: "attended" | "missed") => {
    if (savingIds.current.has(record.id)) return;
    savingIds.current.add(record.id);
    const newTotal = record.total_classes + 1;
    const newAttended = type === "attended" ? record.attended_classes + 1 : record.attended_classes;
    
    const updatedRecord = { 
      ...record, 
      total_classes: newTotal, 
      attended_classes: newAttended 
    };

    // Optimistically update
    setRecords((prev) =>
      prev.map((r) => (r.id === record.id ? updatedRecord : r))
    );

    try {
      await api.post<{ attendance: Attendance }>("/api/attendance", {
        subject: record.subject,
        total_classes: newTotal,
        attended_classes: newAttended,
        threshold: record.threshold
      });
      
      handleRefreshAlert(updatedRecord);
    } catch (err) {
      setRecords((prev) => prev.map((r) => (r.id === record.id ? record : r)));
      setFormError(err instanceof Error ? err.message : "Failed to update attendance");
    } finally {
      savingIds.current.delete(record.id);
    }
  };

  return (
    <div className="max-w-7xl mx-auto min-h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0 mb-6">
        <h1 className="text-2xl font-bold text-foreground">Attendance Tracker</h1>
        <button 
          type="button"
          aria-label="Refresh attendance"
          title="Refresh attendance"
          onClick={() => fetchAttendance(false)}
          className="p-1.5 hover:bg-accent rounded-[10px] text-muted-foreground hover:text-foreground transition-standard cursor-pointer"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {formError && (
        <div role="alert" className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-[10px] text-sm text-destructive animate-in fade-in duration-200">
          {formError}
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-[10px] text-sm text-green-600 animate-in fade-in duration-200">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-y-auto pb-6 pr-1">
        {/* Attendance Form */}
        <div className="bg-card/60 backdrop-blur-xl border border-white/40 rounded-[24px] p-6 shadow-sm h-fit relative overflow-hidden">
          <div className="absolute top-[-20%] left-[-20%] w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <h3 className="font-bold text-foreground text-lg mb-5 flex items-center gap-2 relative z-10">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            Add / Update Subject
          </h3>
          <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
            <div>
              <label className="block text-sm font-semibold text-foreground/80 mb-2">
                Subject Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-4 py-3 bg-card/80 border border-foreground/5 rounded-[14px] text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-muted-foreground/60 shadow-sm"
                placeholder="e.g., OS, DBMS, Networks"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-foreground/80 mb-2">
                  Total Classes <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={totalClasses}
                  onChange={(e) => setTotalClasses(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full px-4 py-3 bg-card/80 border border-foreground/5 rounded-[14px] text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
                  placeholder="0"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground/80 mb-2">
                  Attended <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={attendedClasses}
                  onChange={(e) => setAttendedClasses(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full px-4 py-3 bg-card/80 border border-foreground/5 rounded-[14px] text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
                  placeholder="0"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground/80 mb-2">
                Required Attendance Threshold (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full px-4 py-3 bg-card/80 border border-foreground/5 rounded-[14px] text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
                placeholder="75"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold rounded-[14px] hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer disabled:opacity-50 disabled:hover:translate-y-0 shadow-md"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Attendance
              </button>
            </div>
          </form>
        </div>

        {/* Attendance Records List */}
        <div className="lg:col-span-2 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-card/60 backdrop-blur-xl border border-white/40 rounded-[24px]">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Loading attendance...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="bg-card/60 backdrop-blur-xl border border-white/40 rounded-[24px] p-16 text-center shadow-sm flex flex-col items-center justify-center h-full min-h-[400px]">
              <div className="w-16 h-16 rounded-full bg-foreground/5 flex items-center justify-center mb-5">
                <BarChart3 className="w-8 h-8 text-muted-foreground/60" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">No attendance records</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Add your classes to assess your current percentages and skip-class budgets!
              </p>
            </div>
          ) : (
            <div className="grid gap-5">
              {records.map((record) => {
                const percentage = record.total_classes > 0 
                  ? ((record.attended_classes / record.total_classes) * 100).toFixed(1)
                  : "100.0";
                const isUnderThreshold = Number(percentage) < record.threshold;
                const aiAlert = aiAlerts[record.id];

                return (
                  <div
                    key={record.id}
                    className={`bg-gradient-to-br from-white/90 dark:from-card to-white/50 dark:to-card backdrop-blur-xl border rounded-[20px] p-6 shadow-sm flex flex-col sm:flex-row items-start justify-between gap-5 transition-all hover:shadow-md hover:-translate-y-0.5 ${
                      isUnderThreshold ? "border-destructive/20" : "border-white/40"
                    }`}
                  >
                    <div className="space-y-4 flex-1 w-full">
                      <div className="flex flex-wrap items-center gap-3">
                        <h4 className="font-bold text-foreground text-xl">{record.subject}</h4>
                        <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full ${
                          isUnderThreshold 
                            ? "bg-destructive/15 text-destructive" 
                            : "bg-green-500/15 text-green-700"
                        }`}>
                          {percentage}%
                        </span>
                        <span className="text-xs font-medium text-muted-foreground bg-foreground/5 px-2.5 py-1 rounded-full">
                          Goal: {record.threshold}%
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-medium text-foreground/70">
                          <span>Progress</span>
                          <span>
                            <strong>{record.attended_classes}</strong> / {record.total_classes} classes
                          </span>
                        </div>
                        <div className="w-full bg-foreground/5 rounded-full h-2.5 overflow-hidden border border-foreground/5">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ease-out ${
                              isUnderThreshold ? "bg-gradient-to-r from-destructive to-destructive/70" : "bg-gradient-to-r from-green-500 to-green-400"
                            }`}
                            style={{ width: `${Math.min(Number(percentage), 100)}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2.5 pt-1">
                        <button
                          onClick={() => handleQuickUpdate(record, "attended")}
                          className="text-xs px-4 py-2 rounded-[10px] font-bold bg-green-500/10 text-green-700 hover:bg-green-500/20 hover:scale-105 transition-all cursor-pointer border border-green-500/10"
                        >
                          + Attended
                        </button>
                        <button
                          onClick={() => handleQuickUpdate(record, "missed")}
                          className="text-xs px-4 py-2 rounded-[10px] font-bold bg-destructive/10 text-destructive hover:bg-destructive/20 hover:scale-105 transition-all cursor-pointer border border-destructive/10"
                        >
                          + Missed
                        </button>
                      </div>

                      {/* AI Risk Alerter Message box */}
                      {aiAlert ? (
                        <div className={`mt-4 p-4 text-sm rounded-[14px] flex items-start gap-3 border leading-relaxed shadow-sm ${
                          aiAlert.isAtRisk 
                            ? "bg-destructive/5 border-destructive/10 text-destructive" 
                            : "bg-green-500/5 border-green-500/10 text-green-700"
                        }`}>
                          <div className={`mt-0.5 p-1 rounded-full ${aiAlert.isAtRisk ? "bg-destructive/10" : "bg-green-500/10"}`}>
                            {aiAlert.isAtRisk ? (
                              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                            ) : (
                              <CheckCircle className="w-4 h-4 flex-shrink-0" />
                            )}
                          </div>
                          <div>
                            <span className="font-bold block mb-1 flex items-center gap-1.5 uppercase tracking-wider text-[10px] opacity-80">
                              <Sparkles className="w-3 h-3 text-current animate-pulse" />
                              AI Risk Assessment
                            </span>
                            <span className="font-medium">{aiAlert.message}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-16 bg-muted/40 animate-pulse rounded-[14px] mt-4" />
                      )}
                    </div>

                    <div className="flex sm:flex-col items-center justify-start gap-2 flex-shrink-0 w-full sm:w-auto mt-2 sm:mt-0 border-t sm:border-t-0 sm:border-l border-foreground/5 pt-3 sm:pt-0 sm:pl-3">
                      <button
                        type="button"
                        aria-label={`Recheck risk assessment for ${record.subject}`}
                        onClick={() => handleRefreshAlert(record)}
                        disabled={analyzingId === record.id}
                        className="p-2 w-full sm:w-auto hover:bg-foreground/5 rounded-[12px] text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center justify-center"
                        title="Recheck risk assessment"
                      >
                        <RefreshCw className={`w-4.5 h-4.5 ${analyzingId === record.id ? "animate-spin" : ""}`} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${record.subject} attendance`}
                        onClick={() => handleDelete(record.id)}
                        className="p-2 w-full sm:w-auto hover:bg-destructive/10 rounded-[12px] text-muted-foreground hover:text-destructive transition-all cursor-pointer flex items-center justify-center"
                        title="Delete subject record"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
