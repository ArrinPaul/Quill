"use client";

import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Edit01 as Edit2 } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import type { Task } from "@/features/types";
import { PriorityBadge } from "./PriorityBadge";
import { BOARD_COLUMNS, groupByColumn, isBoardStatus, type BoardStatus } from "../lib/board";

interface TaskBoardProps {
  tasks: Task[];
  onMove: (task: Task, status: BoardStatus) => void;
  onEdit: (task: Task) => void;
}

function BoardCard({ task, onMove, onEdit }: { task: Task } & Omit<TaskBoardProps, "tasks">) {
  const { setNodeRef, listeners, transform, isDragging } = useDraggable({ id: task.id });

  return (
    <li
      ref={setNodeRef}
      {...listeners}
      style={
        transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
      }
      className={cn(
        "bg-card border border-border rounded-[10px] p-3 shadow-sm space-y-2 cursor-grab select-none",
        isDragging && "relative z-20 shadow-lg opacity-90 cursor-grabbing"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          className={cn(
            "text-sm font-semibold break-words min-w-0",
            task.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"
          )}
        >
          {task.title}
        </h3>
        <button
          type="button"
          onClick={() => onEdit(task)}
          aria-label={`Edit ${task.title}`}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer shrink-0"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        {task.subject} ·{" "}
        {new Date(task.deadline).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>
      <PriorityBadge task={task} />
      {/* Keyboard and touch alternative to dragging */}
      <select
        aria-label={`Move ${task.title} to`}
        value={task.status}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onChange={(e) => {
          if (isBoardStatus(e.target.value)) onMove(task, e.target.value);
        }}
        className="w-full px-2 py-1 text-xs rounded-md border border-border bg-background text-foreground cursor-pointer"
      >
        {BOARD_COLUMNS.map((c) => (
          <option key={c.status} value={c.status}>
            {c.status === task.status ? `In: ${c.label}` : `Move to ${c.label}`}
          </option>
        ))}
      </select>
    </li>
  );
}

function Column({
  status,
  label,
  tasks,
  onMove,
  onEdit,
}: { status: BoardStatus; label: string } & TaskBoardProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={cn(
        "w-[80vw] max-w-xs shrink-0 snap-start md:w-auto md:max-w-none rounded-xl border border-border bg-muted/30 p-3 flex flex-col",
        isOver && "border-primary bg-primary/5"
      )}
    >
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center justify-between">
        {label}
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </h2>
      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">No tasks here</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <BoardCard key={task.id} task={task} onMove={onMove} onEdit={onEdit} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function TaskBoard({ tasks, onMove, onEdit }: TaskBoardProps) {
  // A small distance (mouse) or short hold (touch) keeps clicks and scrolling working.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );
  const columns = groupByColumn(tasks);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const task = tasks.find((t) => t.id === active.id);
    if (task && isBoardStatus(over?.id) && over.id !== task.status) onMove(task, over.id);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 md:grid md:grid-cols-3 md:overflow-visible">
        {BOARD_COLUMNS.map((c) => (
          <Column
            key={c.status}
            status={c.status}
            label={c.label}
            tasks={columns[c.status]}
            onMove={onMove}
            onEdit={onEdit}
          />
        ))}
      </div>
    </DndContext>
  );
}
