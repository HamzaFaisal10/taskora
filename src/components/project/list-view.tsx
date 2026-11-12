"use client";

import {
  Archive,
  ArrowDownUp,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ListTodo,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { plural } from "@/lib/plural";
import { DueLabel } from "@/components/tasks/due-label";
import {
  PRIORITY_META,
  PriorityIcon,
  StatusDot,
  type Priority,
} from "@/components/tasks/task-meta";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/menu";
import { EmptyState } from "@/components/ui/surface";
import type { BoardTask, Status } from "@/lib/project/types";
import { cn } from "@/lib/utils";
import { ImportDialog } from "./import-dialog";
import {
  AssigneePicker,
  LabelChips,
  PersonAvatar,
  PriorityPicker,
  StatusPicker,
  statusGroup,
} from "./pickers";
import { isDoneCategory, useProject } from "./store";

type Sort = "manual" | "priority" | "due" | "created" | "title" | "estimate";
const SORTS: { id: Sort; label: string }[] = [
  { id: "manual", label: "Board order" },
  { id: "priority", label: "Priority" },
  { id: "due", label: "Due date" },
  { id: "created", label: "Newest first" },
  { id: "title", label: "Title" },
  { id: "estimate", label: "Estimate" },
];
const RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

function sorter(sort: Sort) {
  return (a: BoardTask, b: BoardTask) => {
    switch (sort) {
      case "priority":
        return RANK[a.priority] - RANK[b.priority] || a.position - b.position;
      case "due":
        // Tasks without a due date go last.
        return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.position - b.position;
      case "created":
        return b.createdAt.localeCompare(a.createdAt);
      case "title":
        return a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true });
      case "estimate":
        return (b.estimate ?? -1) - (a.estimate ?? -1) || a.position - b.position;
      default:
        return a.position - b.position;
    }
  };
}

function Row({
  task,
  status,
  selected,
  onSelect,
  selecting,
}: {
  task: BoardTask;
  status: Status;
  selected: boolean;
  onSelect: (shift: boolean) => void;
  selecting: boolean;
}) {
  const { openTask, people, canEdit } = useProject();
  const done = isDoneCategory(status.category);
  const assignee = people.find((p) => p.id === task.assigneeId);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <li
      onClick={(e) =>
        selecting || e.metaKey || e.ctrlKey ? onSelect(e.shiftKey) : openTask(task.ref)
      }
      className={cn(
        "group border-border-subtle hover:bg-surface grid h-11 cursor-pointer grid-cols-[auto_auto_auto_auto_minmax(0,1fr)_auto_auto] items-center gap-3 border-b px-4 text-sm sm:px-8 md:grid-cols-[auto_auto_4.5rem_auto_minmax(0,1fr)_auto_9rem_5rem]",
        selected && "bg-accent-soft/40 hover:bg-accent-soft/60",
      )}
    >
      <span
        onClick={(e) => {
          stop(e);
          if (canEdit) onSelect(e.shiftKey);
        }}
        className={cn(
          "-m-1.5 flex p-1.5",
          !canEdit && "invisible",
          !selecting &&
            !selected &&
            "md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100",
        )}
      >
        <Checkbox
          checked={selected}
          aria-label={`Select ${task.ref}`}
          // The row handles the click (so Shift-click can select a range).
          onClick={(e) => e.preventDefault()}
        />
      </span>
      <span onClick={stop}>
        <PriorityPicker task={task}>
          <button
            type="button"
            className="hover:bg-elevated rounded p-1"
            aria-label="Change priority"
          >
            <PriorityIcon priority={task.priority} />
          </button>
        </PriorityPicker>
      </span>
      <span className="text-subtle hidden font-mono text-[11px] sm:block">{task.ref}</span>
      <span onClick={stop}>
        <StatusPicker task={task}>
          <button
            type="button"
            className="hover:bg-elevated rounded p-1"
            aria-label={`Status: ${status.name}`}
          >
            <StatusDot color={status.color} group={statusGroup(status.category)} />
          </button>
        </StatusPicker>
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <span className={cn("truncate", done && "text-muted line-through")}>{task.title}</span>
        {task.subtasks.total > 0 && (
          <span className="text-subtle shrink-0 text-xs">
            {task.subtasks.done}/{task.subtasks.total}
          </span>
        )}
      </span>
      <span className="hidden gap-1 lg:flex">
        <LabelChips ids={task.labelIds} max={2} />
      </span>
      <span onClick={stop} className="md:justify-self-start">
        <AssigneePicker task={task}>
          <button
            type="button"
            className="hover:bg-elevated flex items-center gap-2 rounded-full p-0.5 md:pr-2"
            aria-label="Change assignee"
          >
            <PersonAvatar id={task.assigneeId} />
            <span className="text-muted hidden truncate text-xs md:inline">
              {assignee?.name.split(" ")[0] ?? "Unassigned"}
            </span>
          </button>
        </AssigneePicker>
      </span>
      <span className="hidden text-right md:block">
        <DueLabel date={task.dueDate} done={done} />
      </span>
    </li>
  );
}

/** The bar that appears while tasks are selected: change status, priority, assignee or due date, or archive. */
function BulkBar({ ids, onClear }: { ids: string[]; onClear: () => void }) {
  const { statuses, people, sprints, bulkUpdate, bulkArchive, restoreMany } = useProject();
  const [due, setDue] = useState("");
  const n = ids.length;
  const trigger = "h-8 gap-1.5 px-2.5 text-[13px]";
  return (
    <div
      role="toolbar"
      aria-label={`${n} selected`}
      className="bg-elevated border-border shadow-pop animate-pop fixed inset-x-3 bottom-4 z-30 mx-auto flex max-w-max flex-wrap items-center gap-1 rounded-xl border p-1.5 pl-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
    >
      <span className="mr-1 text-[13px] font-medium tabular-nums">{n} selected</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={trigger}>
            Status <ChevronDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {statuses.map((s) => (
            <DropdownMenuItem key={s.id} onSelect={() => bulkUpdate(ids, { statusId: s.id })}>
              <StatusDot color={s.color} group={statusGroup(s.category)} /> {s.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={trigger}>
            Priority <ChevronDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {(["urgent", "high", "medium", "low", "none"] as Priority[]).map((p) => (
            <DropdownMenuItem key={p} onSelect={() => bulkUpdate(ids, { priority: p })}>
              <PriorityIcon priority={p} /> {PRIORITY_META[p].label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={trigger}>
            Assignee <ChevronDown className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 w-52 overflow-y-auto">
          <DropdownMenuItem onSelect={() => bulkUpdate(ids, { assigneeId: null })}>
            <PersonAvatar id={null} /> Unassigned
          </DropdownMenuItem>
          {people.map((p) => (
            <DropdownMenuItem key={p.id} onSelect={() => bulkUpdate(ids, { assigneeId: p.id })}>
              <PersonAvatar id={p.id} /> {p.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {sprints.some((s) => s.state !== "completed") && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className={cn(trigger, "hidden sm:inline-flex")}>
              Sprint <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem onSelect={() => bulkUpdate(ids, { sprintId: null })}>
              No sprint
            </DropdownMenuItem>
            {sprints
              .filter((s) => s.state !== "completed")
              .map((s) => (
                <DropdownMenuItem key={s.id} onSelect={() => bulkUpdate(ids, { sprintId: s.id })}>
                  {s.name}
                  {s.state === "active" && (
                    <span className="text-subtle ml-auto text-xs">Active</span>
                  )}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className={trigger}>
            <CalendarDays className="size-3.5" /> Due
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-60 space-y-2 p-3">
          <label className="text-muted block text-xs" htmlFor="bulk-due">
            Due date for {n} {n === 1 ? "task" : "tasks"}
          </label>
          <input
            id="bulk-due"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="border-border bg-card rounded-control h-9 w-full border px-2 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={!due} onClick={() => bulkUpdate(ids, { dueDate: due })}>
              Set date
            </Button>
            <Button size="sm" variant="ghost" onClick={() => bulkUpdate(ids, { dueDate: null })}>
              Clear dates
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <Button
        variant="ghost"
        size="sm"
        className={cn(trigger, "hover:text-danger-text")}
        onClick={() => {
          const archived = [...ids];
          bulkArchive(archived);
          onClear();
          toast.success(`${plural(archived.length, "task")} archived`, {
            duration: 8000,
            action: {
              label: "Undo",
              onClick: () =>
                void restoreMany(archived).then(
                  (ok) => ok && toast.success(`${plural(archived.length, "task")} restored`),
                ),
            },
          });
        }}
      >
        <Archive className="size-3.5" /> Archive
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={onClear}>
        <X />
      </Button>
    </div>
  );
}

export function ListView() {
  const { statuses, tasks, canEdit } = useProject();
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(statuses.filter((s) => s.category === "canceled").map((s) => s.id)),
  );
  const [sort, setSort] = useState<Sort>("manual");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const groups = useMemo(
    () =>
      statuses
        .map((s) => ({
          status: s,
          list: tasks.filter((t) => t.statusId === s.id).sort(sorter(sort)),
        }))
        .filter((g) => g.list.length > 0),
    [statuses, tasks, sort],
  );
  const visible = useMemo(
    () => groups.flatMap((g) => (collapsed.has(g.status.id) ? [] : g.list.map((t) => t.id))),
    [groups, collapsed],
  );
  // Selections never include tasks that are filtered out or archived.
  const ids = useMemo(() => visible.filter((id) => selected.has(id)), [visible, selected]);

  useEffect(() => {
    if (!selected.size) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog],[role=menu]"))
        setSelected(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.size]);

  const select = (id: string, shift: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shift && anchor && visible.includes(anchor)) {
        const [a, b] = [visible.indexOf(anchor), visible.indexOf(id)].sort((x, y) => x - y);
        for (const v of visible.slice(a, b + 1)) next.add(v);
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAnchor(id);
  };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 sm:px-8">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted h-8 gap-1.5 px-2 text-[13px]">
            <ArrowDownUp className="size-3.5" /> Sort: {SORTS.find((s) => s.id === sort)?.label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuRadioGroup value={sort} onValueChange={(v) => setSort(v as Sort)}>
            {SORTS.map((s) => (
              <DropdownMenuRadioItem key={s.id} value={s.id}>
                {s.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {canEdit && (
        <>
          <span className="text-subtle hidden text-xs md:inline">
            Tick tasks to edit them together · Shift-click selects a range
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted ml-auto h-8 gap-1.5 px-2 text-[13px]"
            onClick={() => setImporting(true)}
          >
            <Upload className="size-3.5" /> Import CSV
          </Button>
        </>
      )}
      {importing && <ImportDialog open={importing} onOpenChange={setImporting} />}
    </div>
  );

  if (tasks.length === 0) {
    return (
      <>
        {toolbar}
        <EmptyState
          icon={<ListTodo />}
          title="No tasks match"
          description="Try clearing the search or filters, or import tasks from a CSV file."
        />
      </>
    );
  }

  return (
    <div className="pb-24">
      {toolbar}
      {groups.map(({ status: s, list }) => {
        const isCollapsed = collapsed.has(s.id);
        const chosen = list.filter((t) => selected.has(t.id)).length;
        return (
          <section key={s.id}>
            <div className="bg-surface border-border sticky top-[121px] z-10 flex h-9 items-center border-b lg:top-[109px]">
              {canEdit && !isCollapsed && (
                <span className="flex pl-4 sm:pl-8">
                  <Checkbox
                    checked={chosen === 0 ? false : chosen === list.length ? true : "indeterminate"}
                    aria-label={`Select all in ${s.name}`}
                    onCheckedChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        const all = chosen === list.length;
                        for (const t of list) {
                          if (all) next.delete(t.id);
                          else next.add(t.id);
                        }
                        return next;
                      })
                    }
                  />
                </span>
              )}
              <button
                type="button"
                onClick={() =>
                  setCollapsed((c) => {
                    const n = new Set(c);
                    if (n.has(s.id)) n.delete(s.id);
                    else n.add(s.id);
                    return n;
                  })
                }
                aria-expanded={!isCollapsed}
                className={cn(
                  "hover:bg-elevated flex h-full flex-1 items-center gap-2 pr-4 text-left text-[13px] font-medium sm:pr-8",
                  canEdit && !isCollapsed ? "pl-3" : "pl-4 sm:pl-8",
                )}
              >
                {isCollapsed ? (
                  <ChevronRight className="text-subtle size-3.5" />
                ) : (
                  <ChevronDown className="text-subtle size-3.5" />
                )}
                <StatusDot color={s.color} group={statusGroup(s.category)} />
                {s.name}
                <span className="text-subtle">{list.length}</span>
              </button>
            </div>
            {!isCollapsed && (
              <ul>
                {list.map((t) => (
                  <Row
                    key={t.id}
                    task={t}
                    status={s}
                    selected={selected.has(t.id)}
                    selecting={ids.length > 0}
                    onSelect={(shift) => select(t.id, shift)}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {ids.length > 0 && <BulkBar ids={ids} onClear={() => setSelected(new Set())} />}
    </div>
  );
}
