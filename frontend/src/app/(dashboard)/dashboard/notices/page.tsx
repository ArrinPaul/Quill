"use client";

import { useQueryAction } from "@/hooks/useQueryAction";
import { useEffect, useState } from "react";
import { Announcement01 as Megaphone, Calendar, Loading01 as Loader2, RefreshCcw01 as RefreshCw, Stars01 as Sparkles } from "@untitledui/icons";
import { api } from "@/lib/api";
import { motion } from "framer-motion";
import type { Notice } from "@/features/types";

type TimelineFilter = "upcoming" | "previous" | "all";

export default function NoticesPage() {
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("upcoming");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  
  // Form input states
  const [noticeText, setNoticeText] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  
  // Status states
  const [summarizing, setSummarizing] = useState(false);
  const [activeNotice, setActiveNotice] = useState<Notice | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setNoticeText("");
    setEventTitle("");
    setEventDate("");
  };

  const startEdit = (notice: Notice) => {
    setEditingId(notice.id);
    setNoticeText(notice.notice_text);
    setEventTitle(notice.event_title || "");
    setEventDate(notice.event_date || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (notice: Notice) => {
    if (!confirm("Delete this notice?")) return;
    setError("");
    setSuccessMsg("");
    try {
      await api.delete(`/api/notices/${notice.id}`);
      setNotices((prev) => prev.filter((n) => n.id !== notice.id));
      setActiveNotice(null);
      if (editingId === notice.id) resetForm();
      setSuccessMsg("Notice deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete notice");
    }
  };

  const fetchNotices = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const noticesRes = await api.get<{ notices: Notice[] }>("/api/notices");
      setNotices(noticesRes.notices || []);
      setLoaded(true);
      
      if (noticesRes.notices && noticesRes.notices.length > 0 && !activeNotice) {
        setActiveNotice(noticesRes.notices[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  useQueryAction("open", loaded, (id) => {
    const notice = notices.find((n) => n.id === id);
    if (!notice) {
      setError("That notice no longer exists.");
      return;
    }
    setTimelineFilter("all");
    setActiveNotice(notice);
  });

  const handleSummarize = async () => {
    setError("");
    setSuccessMsg("");
    if (!noticeText.trim()) {
      setError("Please paste notice text first");
      return;
    }

    setSummarizing(true);
    try {
      const body = {
        notice_text: noticeText,
        event_title: eventTitle || null,
        event_date: eventDate || null,
      };
      const res = editingId
        ? await api.put<{ notice: Notice }>(`/api/notices/${editingId}`, body)
        : await api.post<{ notice: Notice }>("/api/notices", body);
      
      // Update list and select the saved notice
      setNotices((prev) =>
        editingId ? prev.map((n) => (n.id === res.notice.id ? res.notice : n)) : [res.notice, ...prev]
      );
      resetForm();
      setActiveNotice(res.notice);
      setSuccessMsg(
        res.notice.ai_summary
          ? "Notice summarized successfully!"
          : "Notice saved, but the AI summary is unavailable right now."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI summarization failed");
    } finally {
      setSummarizing(false);
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isNoticeUpcoming = (eventDateStr: string | null, createdAtStr: string) => {
    const d = new Date(eventDateStr || createdAtStr);
    return d >= today;
  };

  const filteredNotices = notices.filter((notice) => {
    if (timelineFilter === "all") return true;
    if (timelineFilter === "upcoming") return isNoticeUpcoming(notice.event_date, notice.created_at);
    if (timelineFilter === "previous") return !isNoticeUpcoming(notice.event_date, notice.created_at);
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto min-h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0 mb-6">
        <h1 className="text-2xl font-bold text-foreground">Notices &amp; Summarizer</h1>
      </div>

      {/* Filter Tabs matching the exact Design System of /tasks */}
      <div className="flex gap-4 border-b border-border pb-[1px] mb-4 flex-shrink-0 relative">
        {(["upcoming", "previous", "all"] as const).map((filter) => {
          const isActive = timelineFilter === filter;
          return (
            <button
              key={filter}
              onClick={() => setTimelineFilter(filter)}
              className={`relative px-2 py-2 text-sm transition-colors capitalize cursor-pointer ${
                isActive
                  ? "text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground font-medium"
              }`}
            >
              {filter}
              {isActive && (
                <motion.div
                  layoutId="activeNoticeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-[10px] text-sm text-destructive animate-in fade-in duration-200 mb-4">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-[10px] text-sm text-green-600 animate-in fade-in duration-200 mb-4">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-y-auto pb-6 pr-1">
        {/* Notice Form Input */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card/60 backdrop-blur-xl border border-white/40 rounded-[24px] p-6 shadow-sm space-y-5 relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-10%] w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <label className="block text-sm font-semibold text-foreground/80 mb-2">
                Paste Notice Text <span className="text-destructive">*</span>
              </label>
              <textarea
                aria-label="Notice text"
                value={noticeText}
                onChange={(e) => setNoticeText(e.target.value)}
                className="w-full h-44 px-4 py-3 bg-card/80 border border-foreground/5 rounded-[16px] text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none font-sans placeholder:text-muted-foreground/60 shadow-sm scrollbar-thin"
                placeholder="Paste the full, detailed announcement text from your college portal or group chat here..."
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 relative z-10">
              <div>
                <label className="block text-sm font-semibold text-foreground/80 mb-2 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Associated Event Title (Optional)
                </label>
                <input
                  type="text"
                  aria-label="Associated event title"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-card/80 border border-foreground/5 rounded-[14px] text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-muted-foreground/60 shadow-sm"
                  placeholder="e.g., End Sem Exam"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground/80 mb-2 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-secondary" />
                  Associated Event Date (Optional)
                </label>
                <input
                  type="date"
                  aria-label="Associated event date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-4 py-3 bg-card/80 border border-foreground/5 rounded-[14px] text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2 relative z-10 border-t border-foreground/5 mt-4 pt-5">
              <button
                onClick={handleSummarize}
                disabled={summarizing || !noticeText.trim()}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold rounded-[12px] hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none shadow-md"
              >
                {summarizing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Summarizing notice...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {editingId ? "Save changes" : "Summarize with AI"}
                  </>
                )}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm} className="px-4 py-2.5 border border-border rounded-[12px] text-sm font-semibold cursor-pointer">
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Active Notice Summary View */}
          {activeNotice && (
            <div className="bg-gradient-to-br from-white/90 dark:from-card to-white/50 dark:to-card backdrop-blur-xl border border-white/40 rounded-[24px] p-6 shadow-sm space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-wrap justify-between items-start gap-4">
                <div>
                  <h3 className="font-bold text-foreground text-xl flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    AI-Generated Summary
                  </h3>
                  <p className="text-xs font-medium text-muted-foreground mt-1.5 bg-foreground/5 inline-block px-2 py-1 rounded-[8px]">
                    Created on {new Date(activeNotice.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => startEdit(activeNotice)} className="px-3 py-1.5 border border-border rounded-[10px] text-xs font-semibold hover:bg-accent cursor-pointer">
                    Edit
                  </button>
                  <button type="button" onClick={() => handleDelete(activeNotice)} className="px-3 py-1.5 border border-destructive/30 text-destructive rounded-[10px] text-xs font-semibold hover:bg-destructive/10 cursor-pointer">
                    Delete
                  </button>
                </div>
              </div>

              <div className="p-5 bg-card/80 border border-foreground/5 rounded-[16px] text-sm text-foreground space-y-2 whitespace-pre-line leading-relaxed shadow-sm">
                {activeNotice.ai_summary || "No summary generated for this notice."}
              </div>

              {(activeNotice.event_title || activeNotice.event_date) && (
                <div className="flex flex-wrap gap-4 text-xs font-medium text-muted-foreground pt-3 border-t border-foreground/5">
                  {activeNotice.event_title && (
                    <div className="flex items-center gap-1.5 bg-primary/5 text-primary px-3 py-1.5 rounded-[10px]">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Event: <strong>{activeNotice.event_title}</strong></span>
                    </div>
                  )}
                  {activeNotice.event_date && (
                    <div className="flex items-center gap-1.5 bg-secondary/10 text-secondary px-3 py-1.5 rounded-[10px]">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Date: <strong>{new Date(activeNotice.event_date).toLocaleDateString(undefined, { dateStyle: "medium" })}</strong></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notices History Sidebar */}
        <div className="bg-card/60 backdrop-blur-xl border border-white/40 rounded-[24px] p-5 shadow-sm flex flex-col h-full min-h-[400px]">
          <div className="flex items-center justify-between border-b border-foreground/5 pb-4 mb-4">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Megaphone className="w-4 h-4" />
              </div>
              Recent Notices
            </h3>
            <button 
              type="button"
              aria-label="Refresh notices"
              title="Refresh notices"
              onClick={() => fetchNotices(false)}
              className="p-2 hover:bg-foreground/5 rounded-full text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10">
              <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
              <p className="text-xs font-medium text-muted-foreground">Loading notices...</p>
            </div>
          ) : filteredNotices.length === 0 ? (
            <div className="bg-card/80 border border-foreground/5 rounded-[16px] p-8 text-center shadow-sm my-auto mx-2">
              <Megaphone className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <h3 className="text-base font-bold text-foreground mb-1.5">
                {timelineFilter === "upcoming"
                  ? "No Upcoming Notices"
                  : timelineFilter === "previous"
                  ? "No Previous Notices"
                  : "No notices yet"}
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                {timelineFilter === "all"
                  ? "Paste your first announcement to generate history"
                  : `No notices found under the ${timelineFilter} filter.`}
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3 max-h-[500px] scrollbar-thin pr-2">
              {filteredNotices.map((notice) => (
                <button
                  key={notice.id}
                  onClick={() => setActiveNotice(notice)}
                  className={`w-full text-left p-4 rounded-[16px] transition-all duration-300 border text-xs flex flex-col gap-1.5 cursor-pointer hover:-translate-y-0.5 group ${
                    activeNotice?.id === notice.id
                      ? "bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30 shadow-sm"
                      : "bg-card border-foreground/5 hover:border-primary/30 hover:shadow-sm"
                  }`}
                >
                  <p className={`font-bold line-clamp-1 ${activeNotice?.id === notice.id ? "text-primary" : "text-foreground group-hover:text-primary"}`}>
                    {notice.event_title || notice.notice_text}
                  </p>
                  <p className="text-muted-foreground line-clamp-2 leading-relaxed">
                    {notice.ai_summary || notice.notice_text}
                  </p>
                  <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground mt-2 pt-2 border-t border-foreground/5 w-full">
                    <span>{new Date(notice.created_at).toLocaleDateString()}</span>
                    {notice.broadcast_status && <span className={`inline-block px-2.5 py-1 rounded-full ${
                      notice.broadcast_status === "sent" 
                        ? "bg-green-500/15 text-green-700" 
                        : notice.broadcast_status === "failed"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-yellow-500/15 text-yellow-700"
                    }`}>
                      {notice.broadcast_status}
                    </span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
