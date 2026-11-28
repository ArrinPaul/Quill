"use client";

import { useState } from "react";
import { Bell01 as Bell, Loading01 as Loader2, XClose as X } from "@untitledui/icons";
import { api } from "@/lib/api";
import { useEscape } from "@/hooks/useEscape";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { Task, TaskImportance, TaskRepeat, TaskStatus } from "@/features/types";

interface TaskModalProps {
  /** The task being edited; leave out to create one. */
  task?: Task | null;
  /** Prefills the deadline of a new task, for example the clicked calendar day. */
  defaultDeadline?: Date;
  onClose: () => void;
  onSaved: () => void;
}

const FIELD =
  "w-full px-4 py-3 bg-muted/30 border border-foreground/10 rounded-[14px] text-sm text-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all placeholder:text-muted-foreground/60 shadow-sm";
const LABEL = "block text-sm font-semibold text-foreground/80 mb-2";

/** A Date or ISO string as the local value a datetime-local input expects. */
function toInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function dayBefore(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : toInput(new Date(date.getTime() - 86_400_000));
}

export function TaskModal({ task, defaultDeadline, onClose, onSaved }: TaskModalProps) {
  const isEditing = Boolean(task);
  const initialDeadline = toInput(task?.deadline ?? defaultDeadline);

  const [title, setTitle] = useState(task?.title ?? "");
  const [subject, setSubject] = useState(task?.subject ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [deadline, setDeadline] = useState(initialDeadline);
  const [reminderTime, setReminderTime] = useState(
    task ? toInput(task.reminder_time) : dayBefore(initialDeadline)
  );
  const [importance, setImportance] = useState<TaskImportance>(task?.importance ?? "normal");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "pending");
  const [repeat, setRepeat] = useState<TaskRepeat>(task?.repeat ?? "none");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEscape(true, onClose);
  const dialogRef = useFocusTrap<HTMLDivElement>();

  const handleDeadlineChange = (value: string) => {
    const isAutomatic = !reminderTime || reminderTime === dayBefore(deadline);
    const reminderIsLate = !!reminderTime && !!value && reminderTime > value;
    setDeadline(value);
    if (isAutomatic || reminderIsLate) setReminderTime(dayBefore(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim() || !subject.trim() || !deadline) {
      setError("Title, Subject and Deadline are required");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title,
        subject,
        description: description || null,
        deadline: new Date(deadline).toISOString(),
        reminder_time: new Date(reminderTime || dayBefore(deadline)).toISOString(),
        importance,
        status,
        repeat,
      };
      if (task) await api.put(`/api/tasks/${task.id}`, payload);
      else await api.post("/api/tasks", payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in zoom-in-95 duration-200"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
        className="bg-card rounded-[24px] border border-foreground/5 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto overflow-x-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 pb-4 border-b border-foreground/5 bg-gradient-to-r from-primary/5 to-transparent">
          <div>
            <h2 id="task-modal-title" className="text-xl font-bold tracking-tight text-foreground">
              {isEditing ? "Edit Task" : "Create New Task"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isEditing ? "Update your task details below." : "Add a new assignment or deadline."}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close task modal"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div
              role="alert"
              className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-[16px] text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="task-title" className={LABEL}>
                Title <span className="text-destructive">*</span>
              </label>
              <input
                id="task-title"
                type="text"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={FIELD}
                placeholder="e.g., DBMS Assignment 2"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="task-subject" className={LABEL}>
                  Subject / Category <span className="text-destructive">*</span>
                </label>
                <input
                  id="task-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className={FIELD}
                  placeholder="e.g., DBMS"
                  required
                />
              </div>

              <div>
                <label htmlFor="task-importance" className={LABEL}>
                  Importance
                </label>
                <select
                  id="task-importance"
                  value={importance}
                  onChange={(e) => setImportance(e.target.value as TaskImportance)}
                  className={`${FIELD} cursor-pointer`}
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>

              {isEditing && (
                <div>
                  <label htmlFor="task-status" className={LABEL}>
                    Status
                  </label>
                  <select
                    id="task-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className={`${FIELD} cursor-pointer`}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="task-repeat" className={LABEL}>
                  Repeat
                </label>
                <select
                  id="task-repeat"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value as TaskRepeat)}
                  className={`${FIELD} cursor-pointer`}
                >
                  <option value="none">Does not repeat</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="task-description" className={LABEL}>
                Description
              </label>
              <textarea
                id="task-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`${FIELD} h-28 resize-none scrollbar-thin`}
                placeholder="Additional assignment details, submission link, etc."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="task-deadline" className={LABEL}>
                  Deadline <span className="text-destructive">*</span>
                </label>
                <input
                  id="task-deadline"
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => handleDeadlineChange(e.target.value)}
                  className={FIELD}
                  required
                />
              </div>
              <div>
                <label htmlFor="task-reminder" className={`${LABEL} flex items-center gap-2`}>
                  Reminder
                  <Bell className="w-3.5 h-3.5 text-secondary" />
                </label>
                <input
                  id="task-reminder"
                  type="datetime-local"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className={FIELD}
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-6 mt-6 border-t border-foreground/5">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-card border border-foreground/10 text-foreground font-semibold rounded-[12px] hover:bg-accent transition-all cursor-pointer shadow-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-[12px] hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 shadow-md"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isEditing ? "Save Changes" : "Create Task"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
