"use client";

import { ShareButton } from "@/features/share/ShareButton";
import { useQueryAction } from "@/hooks/useQueryAction";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Edit01 as Edit2,
  Eye,
  File04 as FileText,
  HelpCircle,
  LayersTwo01 as Layers,
  Loading01 as Loader2,
  Plus,
  RefreshCcw01 as RefreshCw,
  SearchSm as Search,
  Trash01 as Trash2,
} from "@untitledui/icons";
import { api } from "@/lib/api";
import { useEscape } from "@/hooks/useEscape";
import { cn } from "@/lib/utils";
import type { Note, NoteSummary } from "@/features/types";
import { useNoteAutoSave } from "../hooks/useNoteAutoSave";
import { NoteAiPanel } from "./NoteAiPanel";

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function NotesWorkspace() {
  const router = useRouter();
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [loadingNote, setLoadingNote] = useState(false);
  const [noteError, setNoteError] = useState("");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEscape(confirmDeleteId !== null, () => setConfirmDeleteId(null));

  const fetchNotes = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setLoadingList(true);
    }
    setListError("");
    try {
      const res = await api.get<{ notes: NoteSummary[] }>("/api/notes");
      setNotes(res.notes || []);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to load notes.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ notes: NoteSummary[] }>("/api/notes")
      .then((res) => {
        if (cancelled) return;
        setNotes(res.notes || []);
      })
      .catch((err) => {
        if (cancelled) return;
        setListError(err instanceof Error ? err.message : "Failed to load notes.");
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSaved = useCallback((saved: Note) => {
    setNotes((prev) => {
      const exists = prev.some((n) => n.id === saved.id);
      const summary: NoteSummary = {
        id: saved.id,
        title: saved.title,
        version: saved.version,
        updated_at: saved.updated_at,
        created_at: saved.created_at,
      };
      const updatedList = exists
        ? prev.map((n) => (n.id === saved.id ? summary : n))
        : [summary, ...prev];
      return [...updatedList].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });
  }, []);

  const { saveStatus, begin, end, retry, overwrite } = useNoteAutoSave({
    noteId: activeNoteId,
    title,
    content,
    onSaved: handleSaved,
  });

  // The note the user asked for last; slower, older responses are ignored.
  const requestedIdRef = useRef<string | null>(null);

  const openNote = useCallback(
    async (id: string, isReload = false) => {
      setLoadingNote(true);
      setNoteError("");
      requestedIdRef.current = id;
      setActiveNoteId(id);
      try {
        // Finish saving the note being left, so reopening it cannot show old text.
        await end({ discard: isReload });
        const res = await api.get<{ note: Note }>(`/api/notes/${id}`);
        if (requestedIdRef.current !== id) return;
        begin(res.note);
        setTitle(res.note.title);
        setContent(res.note.content);
        if (isReload) toast.success("Reloaded latest note version.");
        handleSaved(res.note);
      } catch (err) {
        if (requestedIdRef.current !== id) return;
        setNoteError(err instanceof Error ? err.message : "Failed to load note.");
      }
      setLoadingNote(false);
    },
    [begin, end, handleSaved]
  );

  const handleCreateNote = async () => {
    setCreating(true);
    try {
      const res = await api.post<{ note: Note }>("/api/notes", {
        title: "Untitled",
        content: "",
      });
      const created = res.note;
      setNotes((prev) => [
        {
          id: created.id,
          title: created.title,
          version: created.version,
          updated_at: created.updated_at,
          created_at: created.created_at,
        },
        ...prev,
      ]);
      void end();
      requestedIdRef.current = created.id;
      begin(created);
      setLoadingNote(false);
      setNoteError("");
      setActiveNoteId(created.id);
      setTitle(created.title);
      setContent(created.content);
      setActiveTab("write");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create note.");
    } finally {
      setCreating(false);
    }
  };

  useQueryAction("open", !loadingList && !listError, (id) => void openNote(id));
  useQueryAction("new", !loadingList, () => void handleCreateNote());

  const handleDeleteNote = async (id: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/api/notes/${id}`);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (requestedIdRef.current === id) {
        void end({ discard: true });
        requestedIdRef.current = null;
        setActiveNoteId(null);
        setTitle("");
        setContent("");
      }
      setConfirmDeleteId(null);
      toast.success("Note deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete note.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleOpenFlow = (target: "flashcards" | "quiz") => {
    if (!content.trim()) {
      toast.error("Add some note content first.");
      return;
    }
    const key = target === "flashcards" ? "Quill_prefill_flashcards" : "Quill_prefill_quiz";
    sessionStorage.setItem(
      key,
      JSON.stringify({ title: title.trim() || "Untitled", content })
    );
    router.push(`/dashboard/${target}`);
  };

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => n.title.toLowerCase().includes(q));
  }, [notes, searchQuery]);

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-8rem)] gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Notes</h1>
          <p className="text-sm text-muted-foreground">
            Write Markdown notes with autosave, AI previews, and study exports.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleCreateNote()}
          disabled={creating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          New note
        </button>
      </div>

      <div className="flex flex-1 min-h-[520px] rounded-2xl border border-border bg-card overflow-hidden">
        {/* Note list */}
        <aside
          className={cn(
            "w-full md:w-72 lg:w-80 border-r border-border flex flex-col bg-muted/20",
            activeNoteId ? "hidden md:flex" : "flex"
          )}
        >
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                aria-label="Search notes"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingList ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading notes...
              </div>
            ) : listError ? (
              <div className="p-4 text-center space-y-2">
                <p className="text-sm text-destructive">{listError}</p>
                <button
                  type="button"
                  onClick={() => void fetchNotes()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-accent cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry
                </button>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <FileText className="w-8 h-8 text-muted-foreground mx-auto opacity-60" />
                <p className="text-sm font-medium text-foreground">
                  {notes.length === 0 ? "No notes yet" : "No matching notes"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {notes.length === 0
                    ? "Create your first Markdown note to get started."
                    : "Try a different search term."}
                </p>
              </div>
            ) : (
              filteredNotes.map((item) => {
                const isSelected = item.id === activeNoteId;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "group flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 transition-colors",
                      isSelected
                        ? "bg-primary/10 text-foreground border border-primary/20"
                        : "hover:bg-accent text-foreground border border-transparent"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => void openNote(item.id)}
                      className="flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <p className="text-sm font-medium truncate">{item.title || "Untitled"}</p>
                      <p className="text-xs text-muted-foreground">
                        Updated {formatShortDate(item.updated_at)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(item.id)}
                      aria-label={`Delete ${item.title || "Untitled"}`}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Editor pane */}
        <section
          className={cn(
            "flex-1 flex flex-col min-w-0",
            activeNoteId ? "flex" : "hidden md:flex"
          )}
        >
          {!activeNoteId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <FileText className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Select or create a note</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Pick a note from the list or create a new one to write Markdown, preview safely, and generate study materials.
              </p>
            </div>
          ) : loadingNote ? (
            <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading note...
            </div>
          ) : noteError ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-destructive" />
              <p className="text-sm text-destructive">{noteError}</p>
              <button
                type="button"
                onClick={() => void openNote(activeNoteId)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-accent cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col p-4 sm:p-5 gap-4 min-w-0">
              {/* Top bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      void end();
                      requestedIdRef.current = null;
                      setActiveNoteId(null);
                    }}
                    aria-label="Back to notes list"
                    className="md:hidden p-2 rounded-lg border border-border text-foreground hover:bg-accent cursor-pointer shrink-0"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <input
                    type="text"
                    value={title}
                    maxLength={200}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Note title"
                    aria-label="Note title"
                    className="flex-1 min-w-0 text-lg font-semibold bg-transparent text-foreground border-b border-transparent focus:border-primary focus:outline-none py-1"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Save status */}
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5 px-2">
                    {saveStatus === "saving" && (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Saving...
                      </>
                    )}
                    {saveStatus === "saved" && (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        Saved
                      </>
                    )}
                    {saveStatus === "error" && (
                      <button
                        type="button"
                        onClick={retry}
                        className="inline-flex items-center gap-1 text-destructive hover:underline cursor-pointer"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        Could not save · Retry
                      </button>
                    )}
                  </span>

                  <ShareButton type="note" id={activeNoteId} />

                  <button
                    type="button"
                    onClick={() => handleOpenFlow("flashcards")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground text-xs font-medium cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    Make flashcards
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenFlow("quiz")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground text-xs font-medium cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-primary" />
                    Make quiz
                  </button>
                </div>
              </div>

              {/* Conflict banner */}
              {saveStatus === "conflict" && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-foreground text-xs"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    This note was updated elsewhere. Reload the latest version or overwrite with your changes.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void openNote(activeNoteId, true)}
                      className="px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent font-medium cursor-pointer"
                    >
                      Reload
                    </button>
                    <button
                      type="button"
                      onClick={overwrite}
                      className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 cursor-pointer"
                    >
                      Overwrite
                    </button>
                  </div>
                </div>
              )}

              {/* Write / Preview tabs */}
              <div className="flex items-center justify-between border-b border-border">
                <div role="tablist" aria-label="Note editor mode" className="flex items-center gap-1">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "write"}
                    onClick={() => setActiveTab("write")}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer",
                      activeTab === "write"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Write
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "preview"}
                    onClick={() => setActiveTab("preview")}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer",
                      activeTab === "preview"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview
                  </button>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {content.length.toLocaleString()} / 100,000
                </span>
              </div>

              {/* Editor or Markdown Preview */}
              <div className="flex-1 min-h-[260px] flex flex-col">
                {activeTab === "write" ? (
                  <textarea
                    value={content}
                    maxLength={100_000}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Start writing in Markdown... (# Heading, **bold**, - lists, ```code```)"
                    aria-label="Note Markdown content"
                    className="flex-1 w-full min-h-[260px] p-3 rounded-xl border border-border bg-background text-foreground text-sm font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                ) : (
                  <div className="flex-1 min-h-[260px] p-4 rounded-xl border border-border bg-background overflow-y-auto prose prose-sm dark:prose-invert max-w-none text-foreground">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {content.trim() ? content : "*Nothing to preview yet.*"}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              {/* AI Preview Actions */}
              <div className="pt-2 border-t border-border">
                <NoteAiPanel
                  key={activeNoteId}
                  noteId={activeNoteId}
                  hasContent={content.trim().length > 0}
                  onReplaceContent={(text) => setContent(text)}
                  onAppendContent={(text) =>
                    setContent((prev) => (prev.trim() ? `${prev.trimEnd()}\n\n${text}` : text))
                  }
                />
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Delete confirmation modal */}
      {confirmDeleteId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Delete note confirmation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xl">
            <h2 className="text-base font-semibold text-foreground">Delete this note?</h2>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-3.5 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-accent cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingId === confirmDeleteId}
                onClick={() => void handleDeleteNote(confirmDeleteId)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {deletingId === confirmDeleteId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
