"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { StatusDot } from "@/components/tasks/task-meta";
import { Button } from "@/components/ui/button";
import type { BoardTask, Status } from "@/lib/project/types";
import { cn } from "@/lib/utils";
import { statusGroup } from "./pickers";
import { useProject } from "./store";
import { TaskCard } from "./task-card";

type Columns = Record<string, string[]>;

function buildColumns(statuses: Status[], tasks: BoardTask[]): Columns {
  const cols: Columns = Object.fromEntries(statuses.map((s) => [s.id, [] as string[]]));
  for (const t of [...tasks].sort((a, b) => a.position - b.position)) cols[t.statusId]?.push(t.id);
  return cols;
}

function SortableCard({ task }: { task: BoardTask }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task" },
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-roledescription="Draggable task"
      className="rounded-card focus-visible:outline-accent touch-manipulation outline-offset-2"
    >
      <TaskCard task={task} dragging={isDragging} />
    </div>
  );
}

function QuickAdd({ statusId }: { statusId: string }) {
  const { create, canEdit } = useProject();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  if (!canEdit) return null;
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-subtle hover:text-fg hover:bg-elevated rounded-control flex h-8 w-full items-center gap-1.5 px-2 text-[13px] transition-colors"
      >
        <Plus className="size-3.5" aria-hidden /> Add task
      </button>
    );
  }
  const submit = async () => {
    if (!title.trim()) return setOpen(false);
    setBusy(true);
    await create(title.trim(), { statusId });
    setBusy(false);
    setTitle("");
  };
  return (
    <form
      className="bg-card border-accent rounded-card border p-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") setOpen(false);
        }}
        rows={2}
        placeholder="Task title"
        aria-label="New task title"
        className="placeholder:text-subtle w-full resize-none bg-transparent text-[13.5px] outline-none"
      />
      <div className="flex justify-end gap-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={busy}>
          Add
        </Button>
      </div>
    </form>
  );
}

const DONE_PREVIEW = 8;

function Column({
  status,
  ids,
  tasks,
}: {
  status: Status;
  ids: string[];
  tasks: Map<string, BoardTask>;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col:${status.id}`,
    data: { type: "column", statusId: status.id },
  });
  // Finished work piles up; show the most recent cards and keep the rest one click away.
  const [expanded, setExpanded] = useState(false);
  const isDone = status.category === "completed" || status.category === "canceled";
  const ordered = isDone
    ? [...ids].sort((a, b) =>
        (tasks.get(b)?.completedAt ?? "").localeCompare(tasks.get(a)?.completedAt ?? ""),
      )
    : ids;
  const visible = isDone && !expanded ? ordered.slice(0, DONE_PREVIEW) : ordered;
  return (
    <section
      aria-label={status.name}
      className="bg-surface/60 border-border-subtle rounded-card flex max-h-full w-[min(85vw,300px)] shrink-0 snap-start flex-col border"
    >
      <header className="flex h-11 items-center gap-2 px-3">
        <StatusDot color={status.color} group={statusGroup(status.category)} />
        <h2 className="text-[13px] font-semibold">{status.name}</h2>
        <span className="text-subtle text-xs tabular-nums">{ids.length}</span>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-16 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2",
          isOver && ids.length === 0 && "bg-accent-soft/40 rounded-control",
        )}
      >
        <SortableContext items={visible} strategy={verticalListSortingStrategy}>
          {visible.map((id) => {
            const t = tasks.get(id);
            return t ? <SortableCard key={id} task={t} /> : null;
          })}
        </SortableContext>
        {visible.length < ordered.length && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-muted hover:text-fg hover:bg-elevated rounded-control h-8 text-[13px] transition-colors"
          >
            Show {ordered.length - visible.length} more
          </button>
        )}
        <QuickAdd statusId={status.id} />
      </div>
    </section>
  );
}

export function Board() {
  const { statuses, tasks, move, canEdit } = useProject();
  const visibleStatuses = useMemo(
    () => statuses.filter((s) => s.category !== "triage" || tasks.some((t) => t.statusId === s.id)),
    [statuses, tasks],
  );
  const base = useMemo(() => buildColumns(visibleStatuses, tasks), [visibleStatuses, tasks]);
  const [dragCols, setDragCols] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const columns = dragCols ?? base;
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findColumn = (cols: Columns, id: string) => {
    if (id.startsWith("col:")) return id.slice(4);
    return Object.keys(cols).find((k) => cols[k].includes(id)) ?? null;
  };

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    setDragCols(base);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || !dragCols) return;
    const from = findColumn(dragCols, String(active.id));
    const to = findColumn(dragCols, String(over.id));
    if (!from || !to || from === to) return;
    setDragCols((cols) => {
      if (!cols) return cols;
      const fromIds = cols[from].filter((id) => id !== active.id);
      const toIds = [...cols[to]];
      const overIndex = toIds.indexOf(String(over.id));
      toIds.splice(overIndex >= 0 ? overIndex : toIds.length, 0, String(active.id));
      return { ...cols, [from]: fromIds, [to]: toIds };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const cols = dragCols;
    setActiveId(null);
    setDragCols(null);
    if (!over || !cols) return;
    const id = String(active.id);
    const to = findColumn(cols, String(over.id));
    if (!to) return;
    const ids = [...cols[to]];
    const from = ids.indexOf(id);
    const overIndex = ids.indexOf(String(over.id));
    if (from >= 0 && overIndex >= 0 && from !== overIndex) {
      ids.splice(from, 1);
      ids.splice(overIndex, 0, id);
    }
    const index = ids.indexOf(id);
    const beforeId = index > 0 ? ids[index - 1] : null;
    const afterId = index < ids.length - 1 ? ids[index + 1] : null;
    const task = byId.get(id);
    if (!task) return;
    const original = base[task.statusId] ?? [];
    const unchanged =
      task.statusId === to &&
      original[original.indexOf(id) - 1] === (beforeId ?? undefined) &&
      original[original.indexOf(id) + 1] === (afterId ?? undefined);
    if (!unchanged) move(id, to, beforeId, afterId);
  };

  const active = activeId ? byId.get(activeId) : null;

  return (
    <DndContext
      sensors={canEdit ? sensors : undefined}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setDragCols(null);
      }}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "Press space to pick up a task, use the arrow keys to move it, and press space again to drop it.",
        },
      }}
    >
      <div className="relative flex h-full snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-4 pb-6 sm:snap-none sm:px-8">
        {visibleStatuses.map((s) => (
          <Column key={s.id} status={s} ids={columns[s.id] ?? []} tasks={byId} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.2, 0.9, 0.3, 1)" }}>
        {active ? (
          <div className="w-[min(85vw,284px)]">
            <TaskCard task={active} overlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
