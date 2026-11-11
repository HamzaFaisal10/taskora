"use client";

import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { StatusDot } from "@/components/tasks/task-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import type { BoardTask } from "@/lib/project/types";
import { cn } from "@/lib/utils";
import { PersonAvatar, statusGroup } from "./pickers";
import { isDoneCategory, useProject } from "./store";

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Chip({ task }: { task: BoardTask }) {
  const { openTask, statusById, canEdit } = useProject();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !canEdit,
  });
  const status = statusById.get(task.statusId);
  const done = isDoneCategory(status?.category ?? "");
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={() => openTask(task.ref)}
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 30 }
          : undefined
      }
      className={cn(
        "bg-card border-border hover:border-fg/20 flex w-full touch-manipulation items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-xs",
        isDragging && "shadow-pop",
        done && "text-muted line-through",
      )}
      title={`${task.ref} · ${task.title}`}
    >
      {status && <StatusDot color={status.color} group={statusGroup(status.category)} size={8} />}
      <span className="min-w-0 flex-1 truncate">{task.title}</span>
    </button>
  );
}

function Day({ day, month, tasks }: { day: Date; month: Date; tasks: BoardTask[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: iso(day) });
  const { create, openTask, canEdit } = useProject();
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? tasks : tasks.slice(0, 3);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const quickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const ref = await create(title.trim(), { dueDate: iso(day) });
    setTitle("");
    setAdding(false);
    if (ref) openTask(ref);
  };
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group border-border-subtle min-h-28 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0",
        !isSameMonth(day, month) && "bg-surface/50",
        isOver && "bg-accent-soft/50",
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
            !isSameMonth(day, month) ? "text-subtle" : "text-muted",
            isToday(day) && "bg-accent text-accent-fg font-semibold",
          )}
        >
          {format(day, "d")}
        </span>
        {canEdit && (
          <Popover open={adding} onOpenChange={setAdding}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-subtle hover:text-fg hover:bg-elevated rounded p-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                aria-label={`Add task on ${format(day, "MMMM d")}`}
              >
                <Plus className="size-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <form onSubmit={quickAdd} className="space-y-2">
                <p className="text-muted text-xs">New task due {format(day, "EEE, MMM d")}</p>
                <Input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Task title"
                  aria-label="Task title"
                  className="h-9"
                />
                <Button type="submit" size="sm" className="w-full" disabled={!title.trim()}>
                  Add task
                </Button>
              </form>
            </PopoverContent>
          </Popover>
        )}
      </div>
      <div className="space-y-1">
        {shown.map((t) => (
          <Chip key={t.id} task={t} />
        ))}
        {tasks.length > 3 && !showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-subtle hover:text-fg px-1.5 text-[11px]"
          >
            +{tasks.length - 3} more
          </button>
        )}
      </div>
    </div>
  );
}

function Agenda({ days, byDay }: { days: Date[]; byDay: Map<string, BoardTask[]> }) {
  const { openTask, statusById } = useProject();
  const withTasks = days.filter((d) => byDay.get(iso(d))?.length);
  if (withTasks.length === 0)
    return <p className="text-muted px-4 py-10 text-center text-sm">Nothing due this month.</p>;
  return (
    <ul className="divide-border-subtle divide-y">
      {withTasks.map((d) => (
        <li key={iso(d)} className="px-4 py-3">
          <p
            className={cn("text-muted mb-2 text-xs font-medium", isToday(d) && "text-accent-text")}
          >
            {format(d, "EEEE, MMM d")}
          </p>
          <ul className="space-y-1.5">
            {byDay.get(iso(d))!.map((t) => {
              const s = statusById.get(t.statusId);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => openTask(t.ref)}
                    className="bg-card border-border rounded-control flex w-full items-center gap-2.5 border px-3 py-2.5 text-left text-sm"
                  >
                    {s && <StatusDot color={s.color} group={statusGroup(s.category)} />}
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    <PersonAvatar id={t.assigneeId} size={20} />
                  </button>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export function CalendarView() {
  const { tasks, update } = useProject();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [month]);
  const byDay = useMemo(() => {
    const m = new Map<string, BoardTask[]>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      const list = m.get(t.dueDate) ?? [];
      list.push(t);
      m.set(t.dueDate, list);
    }
    return m;
  }, [tasks]);
  const unscheduled = tasks.filter((t) => !t.dueDate).length;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const task = tasks.find((t) => t.id === active.id);
    const due = String(over.id);
    if (!task || task.dueDate === due) return;
    const patch: { dueDate: string; startDate?: null } = { dueDate: due };
    if (task.startDate && task.startDate > due) patch.startDate = null;
    update(task.id, patch);
  };

  return (
    <div className="pb-10">
      <div className="flex items-center gap-2 px-4 py-3 sm:px-8">
        <h2 className="min-w-36 text-base font-semibold">{format(month, "MMMM yyyy")}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Previous month"
          onClick={() => setMonth((m) => addMonths(m, -1))}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next month"
          onClick={() => setMonth((m) => addMonths(m, 1))}
        >
          <ChevronRight />
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
          Today
        </Button>
        {unscheduled > 0 && (
          <span className="text-subtle ml-auto text-xs">
            {unscheduled} tasks without a due date
          </span>
        )}
      </div>

      <div className="md:hidden">
        <Agenda days={days.filter((d) => isSameMonth(d, month))} byDay={byDay} />
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="border-border rounded-card mx-4 hidden overflow-hidden border sm:mx-8 md:block">
          <div className="bg-surface border-border grid grid-cols-7 border-b">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-subtle px-2 py-2 text-xs font-medium">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => (
              <Day key={iso(d)} day={d} month={month} tasks={byDay.get(iso(d)) ?? []} />
            ))}
          </div>
        </div>
      </DndContext>
    </div>
  );
}
