"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  CheckSquare,
  Loading01 as Loader2,
  Plus,
  Stars01 as Sparkles,
  XClose as X,
} from "@untitledui/icons";
import { api } from "@/lib/api";
import type { NoteAiAction, NoteSuggestedTask } from "@/features/types";

interface EditableSuggestedTask {
  selected: boolean;
  title: string;
  subject: string;
  dueDate: string;
}

interface NoteAiPanelProps {
  noteId: string;
  hasContent: boolean;
  onReplaceContent: (text: string) => void;
  onAppendContent: (text: string) => void;
}

function defaultDueDate(): string {
  const d = new Date(Date.now() + 86400000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeDateInput(val?: string): string {
  if (val && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  return defaultDueDate();
}

export function NoteAiPanel({
  noteId,
  hasContent,
  onReplaceContent,
  onAppendContent,
}: NoteAiPanelProps) {
  const [loadingAction, setLoadingAction] = useState<NoteAiAction | null>(null);
  const [error, setError] = useState("");
  const [activeAction, setActiveAction] = useState<NoteAiAction | null>(null);
  const [previewText, setPreviewText] = useState("");
  const [suggestedTasks, setSuggestedTasks] = useState<EditableSuggestedTask[]>([]);
  const [creatingTasks, setCreatingTasks] = useState(false);

  const runAction = async (action: NoteAiAction) => {
    if (!hasContent) {
      setError("Add some note content before running AI.");
      return;
    }
    setLoadingAction(action);
    setError("");
    try {
      const res = await api.post<{
        action: NoteAiAction;
        result: string | NoteSuggestedTask[];
      }>(`/api/notes/${noteId}/ai`, { action });

      setActiveAction(action);
      if (action === "tasks" && Array.isArray(res.result)) {
        setPreviewText("");
        setSuggestedTasks(
          res.result.map((t) => ({
            selected: true,
            title: t.title,
            subject: t.subject?.trim() || "General",
            dueDate: normalizeDateInput(t.dueDate),
          }))
        );
      } else if (typeof res.result === "string") {
        setSuggestedTasks([]);
        setPreviewText(res.result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI request failed.");
    } finally {
      setLoadingAction(null);
    }
  };

  const dismissPreview = () => {
    setActiveAction(null);
    setPreviewText("");
    setSuggestedTasks([]);
    setError("");
  };

  const handleCreateTasks = async () => {
    const selected = suggestedTasks.filter((t) => t.selected && t.title.trim());
    if (selected.length === 0) {
      toast.error("Select at least one task to create.");
      return;
    }
    setCreatingTasks(true);
    let created = 0;
    try {
      for (const task of selected) {
        const deadline = new Date(`${task.dueDate || defaultDueDate()}T23:59:00`).toISOString();
        await api.post("/api/tasks", {
          title: task.title.trim(),
          subject: task.subject.trim() || "General",
          deadline,
        });
        created += 1;
      }
      toast.success(`Created ${created} task${created === 1 ? "" : "s"}.`);
      dismissPreview();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create some tasks.");
    } finally {
      setCreatingTasks(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground mr-1">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          AI Preview
        </span>
        {(
          [
            { id: "summarize", label: "Summarize" },
            { id: "expand", label: "Expand" },
            { id: "tasks", label: "Suggest tasks" },
          ] as const
        ).map((btn) => (
          <button
            key={btn.id}
            type="button"
            disabled={loadingAction !== null || !hasContent}
            onClick={() => void runAction(btn.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loadingAction === btn.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{btn.label}</span>
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs"
        >
          <span className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </span>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss AI error"
            className="p-0.5 hover:opacity-80 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {activeAction && (activeAction === "summarize" || activeAction === "expand") && previewText && (
        <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
              {activeAction === "summarize" ? "Summary preview" : "Expanded preview"}
            </span>
            <button
              type="button"
              onClick={dismissPreview}
              aria-label="Close AI preview"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground max-h-64 overflow-y-auto pr-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewText}</ReactMarkdown>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
            <button
              type="button"
              onClick={() => {
                onReplaceContent(previewText);
                dismissPreview();
                toast.success("Replaced note content.");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Replace note
            </button>
            <button
              type="button"
              onClick={() => {
                onAppendContent(previewText);
                dismissPreview();
                toast.success("Appended to note.");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-foreground text-xs font-medium cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Append to note
            </button>
            <button
              type="button"
              onClick={dismissPreview}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {activeAction === "tasks" && suggestedTasks.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wider">
              <CheckSquare className="w-3.5 h-3.5 text-primary" />
              Suggested tasks
            </span>
            <button
              type="button"
              onClick={dismissPreview}
              aria-label="Close suggested tasks"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {suggestedTasks.map((task, idx) => (
              <li
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-lg border border-border bg-card"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={task.selected}
                    aria-label={`Select task ${task.title}`}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSuggestedTasks((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, selected: checked } : item))
                      );
                    }}
                    className="h-4 w-4 rounded border-border accent-primary shrink-0"
                  />
                  <input
                    type="text"
                    value={task.title}
                    aria-label="Task title"
                    onChange={(e) => {
                      const val = e.target.value;
                      setSuggestedTasks((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, title: val } : item))
                      );
                    }}
                    className="flex-1 min-w-0 px-2 py-1 rounded border border-border bg-background text-foreground text-xs"
                  />
                </div>
                <div className="flex items-center gap-2 pl-6 sm:pl-0">
                  <input
                    type="text"
                    value={task.subject}
                    aria-label="Task subject"
                    placeholder="Subject"
                    onChange={(e) => {
                      const val = e.target.value;
                      setSuggestedTasks((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, subject: val } : item))
                      );
                    }}
                    className="w-24 px-2 py-1 rounded border border-border bg-background text-foreground text-xs"
                  />
                  <input
                    type="date"
                    value={task.dueDate}
                    aria-label="Task due date"
                    onChange={(e) => {
                      const val = e.target.value;
                      setSuggestedTasks((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, dueDate: val } : item))
                      );
                    }}
                    className="px-2 py-1 rounded border border-border bg-background text-foreground text-xs"
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2 pt-1 border-t border-border">
            <button
              type="button"
              disabled={creatingTasks}
              onClick={() => void handleCreateTasks()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {creatingTasks ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create selected tasks
            </button>
            <button
              type="button"
              onClick={dismissPreview}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
