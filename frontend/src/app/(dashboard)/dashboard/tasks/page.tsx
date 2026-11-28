"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Bell01 as Bell, Calendar, Check, Edit01 as Edit2, List as ListTodo, Loading01 as Loader2, Plus, Repeat01 as Repeat, SearchMd as Search, Trash01 as Trash2 } from "@untitledui/icons";
import { api } from "@/lib/api";
import { daysUntil } from "@/lib/utils";
import { motion } from "framer-motion";
import type { Task, TaskFilter, TaskStatus } from "@/features/types";
import { generateGoogleCalendarUrl } from "@/lib/calendar";
import { sortTasksByPriority } from "@/lib/priority";
import { PriorityBadge } from "@/features/tasks/components/PriorityBadge";
import { usePrioritySort } from "@/features/tasks/hooks/usePrioritySort";
import { TaskBoard } from "@/features/tasks/components/TaskBoard";
import { TaskModal } from "@/features/tasks/components/TaskModal";
import type { BoardStatus } from "@/features/tasks/lib/board";
import { useQueryAction } from "@/hooks/useQueryAction";

function TasksContent() {
  const router = useRouter();
  const isBoard = useSearchParams().get("view") === "board";
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [movingIds, setMovingIds] = useState<ReadonlySet<string>>(new Set());
  const movingRef = useRef(new Set<string>());
  const [activeFilter, setActiveFilter] = useState<TaskFilter>("today");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("all");
  
  // null: closed. { task: null }: creating.
  const [modal, setModal] = useState<{ task: Task | null } | null>(null);
  const handleOpenCreateModal = () => setModal({ task: null });
  const handleOpenEditModal = (task: Task) => setModal({ task });

  const { sortByPriority, toggleSortByPriority } = usePrioritySort("quill.tasks.sortByPriority");

  // Undo delete state
  const [undoToast, setUndoToast] = useState<{ taskId: string; title: string } | null>(null);
  const pendingDeletesRef = useRef<Map<string, { task: Task; timerId: ReturnType<typeof setTimeout> }>>(new Map());

  // Fetch tasks
  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ tasks: Task[] }>("/api/tasks");
      // A task waiting out its undo window must not reappear after a refresh.
      setTasks((res.tasks || []).filter((t) => !pendingDeletesRef.current.has(t.id)));
      setLoaded(true);
    } catch (err) {
      console.error("Failed to fetch tasks", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const flushPendingDeletes = useCallback(() => {
    const entries = Array.from(pendingDeletesRef.current.entries());
    if (entries.length === 0) return;
    pendingDeletesRef.current.clear();
    for (const [id, entry] of entries) {
      clearTimeout(entry.timerId);
      void api.delete(`/api/tasks/${id}`, { keepalive: true }).catch((err) => {
        console.error("Failed to flush task delete", err);
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener("pagehide", flushPendingDeletes);
    return () => {
      window.removeEventListener("pagehide", flushPendingDeletes);
      flushPendingDeletes();
    };
  }, [flushPendingDeletes]);

  const subjects = useMemo(
    () =>
      Array.from(new Set(tasks.map((t) => t.subject).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [tasks]
  );

  // Filters logic
  const filteredTasks = tasks.filter((task) => {
    if (activeFilter === "in_progress") {
      if (task.status !== "in_progress") return false;
    } else if (activeFilter === "completed") {
      if (task.status !== "completed") return false;
    } else if ((task.status === "completed" || task.status === "cancelled") && activeFilter !== "all") {
      return false; // hide completed in other lists
    } else if (activeFilter === "today") {
      const taskDate = new Date(task.deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (taskDate < today || taskDate >= tomorrow) return false;
    } else if (activeFilter === "upcoming") {
      const days = daysUntil(task.deadline);
      if (days < 0 || days > 7) return false;
    }

    if (selectedSubject !== "all" && task.subject !== selectedSubject) {
      return false;
    }

    const q = searchQuery.trim().toLowerCase();
    if (q && !task.title.toLowerCase().includes(q) && !task.subject.toLowerCase().includes(q)) {
      return false;
    }

    return true;
  });

  const displayedTasks = sortByPriority
    ? sortTasksByPriority(filteredTasks)
    : [...filteredTasks].sort(
        (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      );

  const handleDelete = (task: Task) => {
    const existing = pendingDeletesRef.current.get(task.id);
    if (existing) {
      clearTimeout(existing.timerId);
    }

    setTasks((prev) => prev.filter((t) => t.id !== task.id));

    const timerId = setTimeout(async () => {
      pendingDeletesRef.current.delete(task.id);
      setUndoToast((prev) => (prev?.taskId === task.id ? null : prev));
      try {
        await api.delete(`/api/tasks/${task.id}`);
      } catch (err) {
        console.error("Failed to delete task", err);
        setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev : [...prev, task]));
      }
    }, 5000);

    pendingDeletesRef.current.set(task.id, { task, timerId });
    setUndoToast({ taskId: task.id, title: task.title });
  };

  const handleUndoDelete = (taskId: string) => {
    const entry = pendingDeletesRef.current.get(taskId);
    if (!entry) return;
    clearTimeout(entry.timerId);
    pendingDeletesRef.current.delete(taskId);
    setTasks((prev) => (prev.some((t) => t.id === taskId) ? prev : [...prev, entry.task]));
    setUndoToast((prev) => (prev?.taskId === taskId ? null : prev));
  };

  const handleToggleStatus = async (task: Task) => {
    const newStatus: TaskStatus = task.status === "completed" ? "pending" : "completed";
    try {
      const updated = await api.put<{ task: Task; nextTask?: Task }>(`/api/tasks/${task.id}`, {
        status: newStatus,
      });
      setTasks((prev) => {
        const mapped = prev.map((t) => (t.id === task.id ? updated.task : t));
        if (updated.nextTask && !mapped.some((t) => t.id === updated.nextTask!.id)) {
          return [...mapped, updated.nextTask];
        }
        return mapped;
      });
    } catch (err) {
      console.error("Failed to toggle task status", err);
    }
  };

  const handleMove = async (task: Task, status: BoardStatus) => {
    // A second move while the first is pending could be undone by the first one failing.
    if (movingRef.current.has(task.id)) return;
    movingRef.current.add(task.id);
    setMovingIds(new Set(movingRef.current));
    const setStatus = (value: TaskStatus) =>
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: value } : t)));
    setStatus(status);
    try {
      const res = await api.put<{ task: Task; nextTask?: Task }>(`/api/tasks/${task.id}`, { status });
      setTasks((prev) => {
        const mapped = prev.map((t) => (t.id === task.id ? res.task : t));
        const next = res.nextTask;
        return next && !mapped.some((t) => t.id === next.id) ? [...mapped, next] : mapped;
      });
    } catch {
      setStatus(task.status);
      toast.error(`Could not move "${task.title}". Please try again.`);
    } finally {
      movingRef.current.delete(task.id);
      setMovingIds(new Set(movingRef.current));
    }
  };

  // The board has its own status columns, so only search and subject narrow it.
  const boardTasks = tasks.filter((task) => {
    if (selectedSubject !== "all" && task.subject !== selectedSubject) return false;
    const q = searchQuery.trim().toLowerCase();
    return !q || task.title.toLowerCase().includes(q) || task.subject.toLowerCase().includes(q);
  });

  useQueryAction("new", !loading, () => handleOpenCreateModal());
  useQueryAction("open", loaded, (id) => {
    const task = tasks.find((t) => t.id === id);
    if (task) handleOpenEditModal(task);
    else toast.error("That task no longer exists.");
  });

  const getDaysLeft = (deadlineStr: string) => {
    const days = daysUntil(deadlineStr);
    
    if (days < 0) return "Overdue";
    if (days === 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    return `${days} days left`;
  };

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0 mb-6">
        <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Task view" className="flex rounded-[10px] border border-border bg-card p-0.5">
            {([false, true] as const).map((board) => (
              <button
                key={String(board)}
                type="button"
                aria-pressed={isBoard === board}
                onClick={() => router.replace(board ? "/dashboard/tasks?view=board" : "/dashboard/tasks", { scroll: false })}
                className={`px-3 py-1.5 text-xs font-semibold rounded-[8px] cursor-pointer ${isBoard === board ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {board ? "Board" : "List"}
              </button>
            ))}
          </div>
        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-[10px] hover:opacity-90 transition-standard cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          New Task
        </button>
        </div>
      </div>

      {/* Filter Tabs & Controls */}
      <div className="flex flex-col gap-3 border-b border-border pb-3 mb-4 flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className={`flex-wrap gap-3 relative ${isBoard ? "hidden" : "flex"}`}>
            {(["today", "upcoming", "in_progress", "completed", "all"] as const).map((filter) => {
              const isActive = activeFilter === filter;
              const label = filter === "in_progress" ? "In progress" : filter;
              return (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`relative px-2 py-2 text-sm transition-colors capitalize cursor-pointer ${
                    isActive
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground font-medium"
                  }`}
                >
                  {label}
                  {isActive && (
                    <motion.div
                      layoutId="activeTaskTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by subject"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium rounded-[10px] border border-border bg-card text-foreground cursor-pointer"
            >
              <option value="all">All subjects</option>
              {subjects.map((subj) => (
                <option key={subj} value={subj}>
                  {subj}
                </option>
              ))}
            </select>
            <select
              hidden={isBoard}
              aria-label="Sort tasks"
              value={sortByPriority ? "priority" : "deadline"}
              onChange={(e) => {
                const wantPriority = e.target.value === "priority";
                if (wantPriority !== sortByPriority) toggleSortByPriority();
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-[10px] border border-border bg-card text-foreground cursor-pointer"
            >
              <option value="deadline">Sort: Deadline</option>
              <option value="priority">Sort: Priority</option>
            </select>
          </div>
        </div>
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title or subject..."
            aria-label="Search tasks"
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-card border border-border rounded-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pr-1 pb-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 h-full">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
            <p className="text-sm text-muted-foreground">Loading tasks...</p>
          </div>
        ) : isBoard ? (
          <TaskBoard tasks={boardTasks} movingIds={movingIds} onMove={handleMove} onEdit={handleOpenEditModal} />
        ) : displayedTasks.length === 0 ? (
          <div className="bg-card border border-border rounded-[10px] p-12 text-center shadow-sm max-w-md mx-auto mt-10">
            <ListTodo className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No tasks found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {activeFilter === "all" 
                ? "Create your first task to get started with deadline tracking." 
                : `No tasks found for "${activeFilter}" filter.`}
            </p>
            {activeFilter === "all" && (
              <button 
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-[10px] hover:opacity-90 transition-standard cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Create Task
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            {displayedTasks.map((task) => (
              <div
                key={task.id}
              className={`bg-card border rounded-[10px] p-5 shadow-sm transition-all hover:shadow-md flex items-start gap-4 ${
                task.status === "completed" ? "opacity-75 border-green-200 bg-green-50/10" : "border-border"
              }`}
            >
              {/* Status toggle button */}
              <button
                type="button"
                aria-label={task.status === "completed" ? `Mark ${task.title} as pending` : `Mark ${task.title} as completed`}
                onClick={() => handleToggleStatus(task)}
                className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors cursor-pointer ${
                  task.status === "completed"
                    ? "bg-green-500 border-green-500 text-white"
                    : "border-muted-foreground hover:border-primary hover:bg-primary/5 text-transparent"
                }`}
              >
                <Check className="w-4 h-4" />
              </button>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className={`text-base font-semibold text-foreground break-words ${task.status === "completed" || task.status === "cancelled" ? "line-through text-muted-foreground" : ""}`}>
                      {task.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-muted text-muted-foreground rounded-[10px]">
                        {task.subject}
                      </span>
                      {task.status === "in_progress" && (
                        <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-[10px]">
                          In progress
                        </span>
                      )}
                      {task.repeat === "weekly" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-primary/10 text-primary rounded-[10px]">
                          <Repeat className="w-3 h-3" />
                          Weekly
                        </span>
                      )}
                      <PriorityBadge task={task} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={generateGoogleCalendarUrl(task.title, task.description || "", task.deadline)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 hover:bg-blue-50 rounded-[10px] text-muted-foreground hover:text-blue-600 transition-standard cursor-pointer"
                      title="Add to Google Calendar"
                    >
                      <Calendar className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleOpenEditModal(task)}
                      className="p-1.5 hover:bg-accent rounded-[10px] text-muted-foreground hover:text-foreground transition-standard cursor-pointer"
                      title="Edit task"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(task)}
                      className="p-1.5 hover:bg-destructive/10 rounded-[10px] text-muted-foreground hover:text-destructive transition-standard cursor-pointer"
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {task.description && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-2 leading-relaxed">
                    {task.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-3 border-t border-dashed border-border mt-3">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span>
                      Deadline: {new Date(task.deadline).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                      <span className={`ml-2 font-medium ${
                        task.status === "completed" 
                          ? "text-green-600" 
                          : task.status === "cancelled"
                            ? "text-muted-foreground"
                          : getDaysLeft(task.deadline) === "Overdue" 
                            ? "text-destructive" 
                            : "text-orange-600"
                      }`}>
                        ({task.status === "completed" ? "Completed" : task.status === "cancelled" ? "Cancelled" : getDaysLeft(task.deadline)})
                      </span>
                    </span>
                  </div>
                  {task.reminder_time && (
                    <div className="flex items-center gap-1.5">
                      <Bell className="w-3.5 h-3.5 text-secondary" />
                      <span>
                        Reminder: {new Date(task.reminder_time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>

      {modal && (
        <TaskModal key={modal.task?.id ?? "new"} task={modal.task} onClose={() => setModal(null)} onSaved={fetchTasks} />
      )}

      {undoToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-[12px] shadow-lg text-sm text-foreground max-w-[calc(100vw-2.5rem)]"
        >
          <span className="truncate">Deleted &ldquo;{undoToast.title}&rdquo;</span>
          <button
            type="button"
            onClick={() => handleUndoDelete(undoToast.taskId)}
            className="px-2.5 py-1 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer flex-shrink-0"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense>
      <TasksContent />
    </Suspense>
  );
}
