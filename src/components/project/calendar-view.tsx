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
  addWeeks,
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

function Chip({ task, week = false }: { task: BoardTask; week?: boolean }) {
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
        "bg-card border-border hover:border-fg/20 flex w-full touch-manipulation gap-1.5 rounded-md border px-1.5 py-1 text-left text-xs",
        week ? "items-start py-1.5" : "items-center",
        isDragging && "shadow-pop",
        done && "text-muted line-through",
      )}
      title={`${task.ref} · ${task.title}`}
    >
      {status && (
        <span className={cn(week && "mt-[3px]")}>
          <StatusDot color={status.color} group={statusGroup(status.category)} size={8} />
        </span>
      )}
      <span className={cn("min-w-0 flex-1", week ? "line-clamp-2 leading-snug" : "truncate")}>
        {task.title}
      </span>
      {week && task.assigneeId && <PersonAvatar id={task.assigneeId} size={16} />}
    </button>
  );
}

function Day({
  day,
  month,
  tasks,
  week = false,
}: {
  day: Date;
  month: Date;
  tasks: BoardTask[];
  week?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: iso(day) });
  const { create, openTask, canEdit } = useProject();
  const [showAll, setShowAll] = useState(false);
  const shown = showAll || week ? tasks : tasks.slice(0, 3);
  const outside = !week && !isSameMonth(day, month);
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
        "group border-border-subtle border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0",
        week ? "min-h-[28rem]" : "min-h-28",
        outside && "bg-surface/50",
        isOver && "bg-accent-soft/50",
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          {week && <span className="text-subtle text-xs">{format(day, "EEE")}</span>}
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
              outside ? "text-subtle" : "text-muted",
              isToday(day) && "bg-accent text-accent-fg font-semibold",
            )}
          >
            {format(day, "d")}
          </span>
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
                  maxLength={300}
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
          <Chip key={t.id} task={t} week={week} />
        ))}
        {week && tasks.length === 0 && (
          <p className="text-subtle px-1.5 pt-2 text-[11px]">Nothing due</p>
        )}
        {!week && tasks.length > 3 && !showAll && (
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

type Mode = "month" | "week";

export function CalendarView() {
  const { tasks, update } = useProject();
  const [mode, setMode] = useState<Mode>("month");
  // The day the view is anchored on: any day in the shown month or week.
  const [cursor, setCursor] = useState(() => new Date());
  const month = startOfMonth(cursor);
  const days = useMemo(() => {
    const start =
      mode === "week"
        ? startOfWeek(cursor, { weekStartsOn: 1 })
        : startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end =
      mode === "week"
        ? endOfWeek(cursor, { weekStartsOn: 1 })
        : endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [cursor, mode]);
  const step = (n: number) =>
    setCursor((c) => (mode === "week" ? addWeeks(c, n) : addMonths(startOfMonth(c), n)));
  const weekStart = days[0];
  const weekEnd = days[days.length - 1];
  const title =
    mode === "month"
      ? format(month, "MMMM yyyy")
      : isSameMonth(weekStart, weekEnd)
        ? `${format(weekStart, "MMM d")} – ${format(weekEnd, "d, yyyy")}`
        : `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;
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
        <h2 className="min-w-36 text-base font-semibold tabular-nums" aria-live="polite">
          {title}
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={mode === "week" ? "Previous week" : "Previous month"}
          onClick={() => step(-1)}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={mode === "week" ? "Next week" : "Next month"}
          onClick={() => step(1)}
        >
          <ChevronRight />
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>
          Today
        </Button>
        <div
          role="radiogroup"
          aria-label="Calendar range"
          className="border-border bg-surface ml-auto flex rounded-[9px] border p-0.5"
        >
          {(["month", "week"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "text-muted hover:text-fg rounded-[7px] px-2.5 py-1 text-[13px] font-medium capitalize",
                mode === m && "bg-elevated text-fg shadow-sm",
              )}
            >
              {m}
            </button>
          ))}
        </div>
        {unscheduled > 0 && (
          <span className="text-subtle hidden text-xs lg:inline">
            {unscheduled} tasks without a due date
          </span>
        )}
      </div>

      <div className="md:hidden">
        <Agenda
          days={mode === "week" ? days : days.filter((d) => isSameMonth(d, month))}
          byDay={byDay}
        />
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="border-border rounded-card mx-4 hidden overflow-hidden border sm:mx-8 md:block">
          <div
            className={cn(
              "bg-surface border-border grid grid-cols-7 border-b",
              mode === "week" && "hidden",
            )}
          >
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-subtle px-2 py-2 text-xs font-medium">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => (
              <Day
                key={iso(d)}
                day={d}
                month={month}
                week={mode === "week"}
                tasks={byDay.get(iso(d)) ?? []}
              />
            ))}
          </div>
        </div>
      </DndContext>
    </div>
  );
}
