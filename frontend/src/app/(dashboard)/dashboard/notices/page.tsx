"use client";

import { useEffect, useState } from "react";
import { Announcement01 as Megaphone, Bell01 as Bell, Calendar, Clock, Loading01 as Loader2, RefreshCcw01 as RefreshCw, Send01 as Send, Stars01 as Sparkles, Users01 as Users } from "@untitledui/icons";
import { api } from "@/lib/api";
import { motion } from "framer-motion";
import type { Notice } from "@/features/types";

interface GroupEvent {
  id: string;
  group_id: string;
  title: string;
  event_date: string;
  priority: string;
  category: string;
  raw_message: string;
  created_at: string;
  telegram_groups?: { name: string };
}

type TimelineFilter = "upcoming" | "previous" | "all";

export default function NoticesPage() {
  const [viewMode, setViewMode] = useState<"group" | "personal">("group");
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("upcoming");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [groupEvents, setGroupEvents] = useState<GroupEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form input states
  const [noticeText, setNoticeText] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  
  // Status states
  const [summarizing, setSummarizing] = useState(false);
  const [broadcastingId, setBroadcastingId] = useState<string | null>(null);
  const [activeNotice, setActiveNotice] = useState<Notice | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchNotices = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [noticesRes, eventsRes] = await Promise.all([
        api.get<{ notices: Notice[] }>("/api/notices").catch(() => ({ notices: [] })),
        api.get<{ events: GroupEvent[] }>("/api/groups/events").catch(() => ({ events: [] }))
      ]);
      setNotices(noticesRes.notices || []);
      setGroupEvents(eventsRes.events || []);
      
      if (noticesRes.notices && noticesRes.notices.length > 0 && !activeNotice) {
        // Default to showing the latest personal notice if none selected
        setActiveNotice(noticesRes.notices[0]);
      }
    } catch (err) {
      console.error("Failed to fetch notices", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const handleSummarize = async () => {
    setError("");
    setSuccessMsg("");
    if (!noticeText.trim()) {
      setError("Please paste notice text first");
      return;
    }

    setSummarizing(true);
    try {
      const res = await api.post<{ notice: Notice }>("/api/notices", {
        notice_text: noticeText,
        event_title: eventTitle || null,
        event_date: eventDate || null,
      });
      
      setNoticeText("");
      setEventTitle("");
      setEventDate("");
      
      // Update list and select the newly created notice
      setNotices((prev) => [res.notice, ...prev]);
      setActiveNotice(res.notice);
      setSuccessMsg("Notice summarized successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI summarization failed");
    } finally {
      setSummarizing(false);
    }
  };

  const handleBroadcast = async (noticeId: string) => {
    setError("");
    setSuccessMsg("");
    setBroadcastingId(noticeId);
    
    try {
      const res = await api.post<{ success: boolean }>("/api/notices/broadcast", {
        notice_id: noticeId
      });
      
      if (res.success) {
        setSuccessMsg("Broadcast sent to Telegram bot successfully!");
        // Update local broadcast status
        setNotices((prev) => 
          prev.map((n) => n.id === noticeId ? { ...n, broadcast_status: "sent" } : n)
        );
        if (activeNotice && activeNotice.id === noticeId) {
          setActiveNotice({ ...activeNotice, broadcast_status: "sent" });
        }
      } else {
        setError("n8n notice broadcast failed to deliver");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to broadcast notice");
    } finally {
      setBroadcastingId(null);
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isEventUpcoming = (eventDateStr: string) => {
    const d = new Date(eventDateStr);
    return d >= today;
  };

  const isNoticeUpcoming = (eventDateStr: string | null, createdAtStr: string) => {
    const d = new Date(eventDateStr || createdAtStr);
    return d >= today;
  };

  const filteredGroupEvents = groupEvents.filter((event) => {
    if (timelineFilter === "all") return true;
    if (timelineFilter === "upcoming") return isEventUpcoming(event.event_date);
    if (timelineFilter === "previous") return !isEventUpcoming(event.event_date);
    return true;
  });

  const filteredNotices = notices.filter((notice) => {
    if (timelineFilter === "all") return true;
    if (timelineFilter === "upcoming") return isNoticeUpcoming(notice.event_date, notice.created_at);
    if (timelineFilter === "previous") return !isNoticeUpcoming(notice.event_date, notice.created_at);
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0 mb-6">
        <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
        <div className="flex bg-muted/40 p-1 rounded-[10px] w-full max-w-sm">
          <button 
            onClick={() => setViewMode("group")} 
            className={`flex-1 text-sm font-medium py-1.5 rounded-[8px] transition-standard flex items-center justify-center gap-2 ${viewMode === "group" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Users className="w-4 h-4" /> Group
          </button>
          <button 
            onClick={() => setViewMode("personal")} 
            className={`flex-1 text-sm font-medium py-1.5 rounded-[8px] transition-standard flex items-center justify-center gap-2 ${viewMode === "personal" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Sparkles className="w-4 h-4" /> Summarizer
          </button>
        </div>
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

      {viewMode === "group" ? (
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 pb-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-primary animate-spin mb-2" />
              <p className="text-sm text-muted-foreground">Loading announcements...</p>
            </div>
          ) : filteredGroupEvents.length === 0 ? (
            <div className="bg-white border border-border rounded-[10px] p-12 text-center shadow-sm">
              <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {timelineFilter === "upcoming"
                  ? "No Upcoming Announcements"
                  : timelineFilter === "previous"
                  ? "No Previous Announcements"
                  : "No Group Announcements"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {timelineFilter === "all"
                  ? "Join a group via invite link to receive teacher announcements here."
                  : `No announcements found under the ${timelineFilter} category.`}
              </p>
            </div>
          ) : (
            filteredGroupEvents.map(event => (
              <div key={event.id} className="bg-white border border-border rounded-[10px] p-5 shadow-sm space-y-3 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium px-2 py-1 bg-primary/10 text-primary rounded-full inline-flex items-center gap-1.5">
                    <Users className="w-3 h-3" />
                    {event.telegram_groups?.name || "Unknown Group"}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">{new Date(event.created_at).toLocaleDateString()}</span>
                </div>
                <h3 className="font-bold text-foreground text-lg">{event.title}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{event.raw_message}</p>
                <div className="flex items-center gap-4 text-xs font-medium pt-3 border-t border-border mt-3">
                  <div className="flex items-center gap-1.5 text-secondary"><Calendar className="w-3.5 h-3.5"/> Due: {new Date(event.event_date).toLocaleDateString()}</div>
                  <div className="flex items-center gap-1.5 text-amber-600"><Megaphone className="w-3.5 h-3.5"/> {event.priority} Priority</div>
                  <div className="flex items-center gap-1.5 text-purple-600"><Clock className="w-3.5 h-3.5"/> {event.category}</div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0 overflow-y-auto pb-6 pr-1">
        {/* Notice Form Input */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-[24px] p-6 shadow-sm space-y-5 relative overflow-hidden">
            <div className="absolute top-[-20%] left-[-10%] w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <label className="block text-sm font-semibold text-foreground/80 mb-2">
                Paste Notice Text <span className="text-destructive">*</span>
              </label>
              <textarea
                value={noticeText}
                onChange={(e) => setNoticeText(e.target.value)}
                className="w-full h-44 px-4 py-3 bg-white/80 border border-black/5 rounded-[16px] text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none font-sans placeholder:text-muted-foreground/60 shadow-sm scrollbar-thin"
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
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-white/80 border border-black/5 rounded-[14px] text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-muted-foreground/60 shadow-sm"
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
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-4 py-3 bg-white/80 border border-black/5 rounded-[14px] text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2 relative z-10 border-t border-black/5 mt-4 pt-5">
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
                    Summarize with AI
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Active Notice Summary View */}
          {activeNotice && (
            <div className="bg-gradient-to-br from-white/90 to-white/50 backdrop-blur-xl border border-white/40 rounded-[24px] p-6 shadow-sm space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="font-bold text-foreground text-xl flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    AI-Generated Summary
                  </h3>
                  <p className="text-xs font-medium text-muted-foreground mt-1.5 bg-black/5 inline-block px-2 py-1 rounded-[8px]">
                    Created on {new Date(activeNotice.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => handleBroadcast(activeNotice.id)}
                  disabled={broadcastingId === activeNotice.id}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background font-semibold rounded-[12px] hover:bg-primary transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {broadcastingId === activeNotice.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {activeNotice.broadcast_status === "sent" ? "Re-Broadcast" : "Broadcast (TG)"}
                </button>
              </div>

              <div className="p-5 bg-white/80 border border-black/5 rounded-[16px] text-sm text-foreground space-y-2 whitespace-pre-line leading-relaxed shadow-sm">
                {activeNotice.ai_summary || "No summary generated for this notice."}
              </div>

              {(activeNotice.event_title || activeNotice.event_date) && (
                <div className="flex flex-wrap gap-4 text-xs font-medium text-muted-foreground pt-3 border-t border-black/5">
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
        <div className="bg-white/60 backdrop-blur-xl border border-white/40 rounded-[24px] p-5 shadow-sm flex flex-col h-full min-h-[400px]">
          <div className="flex items-center justify-between border-b border-black/5 pb-4 mb-4">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Megaphone className="w-4 h-4" />
              </div>
              Recent Notices
            </h3>
            <button 
              onClick={() => fetchNotices(false)}
              className="p-2 hover:bg-black/5 rounded-full text-muted-foreground hover:text-foreground transition-all cursor-pointer"
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
            <div className="bg-white/80 border border-black/5 rounded-[16px] p-8 text-center shadow-sm my-auto mx-2">
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
                      : "bg-white border-black/5 hover:border-primary/30 hover:shadow-sm"
                  }`}
                >
                  <p className={`font-bold line-clamp-1 ${activeNotice?.id === notice.id ? "text-primary" : "text-foreground group-hover:text-primary"}`}>
                    {notice.event_title || notice.notice_text}
                  </p>
                  <p className="text-muted-foreground line-clamp-2 leading-relaxed">
                    {notice.ai_summary || notice.notice_text}
                  </p>
                  <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground mt-2 pt-2 border-t border-black/5 w-full">
                    <span>{new Date(notice.created_at).toLocaleDateString()}</span>
                    <span className={`inline-block px-2.5 py-1 rounded-full ${
                      notice.broadcast_status === "sent" 
                        ? "bg-green-500/15 text-green-700" 
                        : notice.broadcast_status === "failed"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-yellow-500/15 text-yellow-700"
                    }`}>
                      {notice.broadcast_status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
