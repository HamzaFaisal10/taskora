"use client";

import { ChevronDown, ChevronRight, ListTodo } from "lucide-react";
import { useState } from "react";
import { DueLabel } from "@/components/tasks/due-label";
import { PriorityIcon, StatusDot } from "@/components/tasks/task-meta";
import { EmptyState } from "@/components/ui/surface";
import type { BoardTask, Status } from "@/lib/project/types";
import { cn } from "@/lib/utils";
import {
  AssigneePicker,
  LabelChips,
  PersonAvatar,
  PriorityPicker,
  StatusPicker,
  statusGroup,
} from "./pickers";
import { isDoneCategory, useProject } from "./store";

function Row({ task, status }: { task: BoardTask; status: Status }) {
  const { openTask, people } = useProject();
  const done = isDoneCategory(status.category);
  const assignee = people.find((p) => p.id === task.assigneeId);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <li
      onClick={() => openTask(task.ref)}
      className="border-border-subtle hover:bg-surface grid h-11 cursor-pointer grid-cols-[auto_auto_auto_minmax(0,1fr)_auto_auto] items-center gap-3 border-b px-4 text-sm sm:px-8 md:grid-cols-[auto_4.5rem_auto_minmax(0,1fr)_auto_9rem_5rem]"
    >
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

export function ListView() {
  const { statuses, tasks } = useProject();
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(statuses.filter((s) => s.category === "canceled").map((s) => s.id)),
  );

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<ListTodo />}
        title="No tasks match"
        description="Try clearing the search or filters."
      />
    );
  }

  return (
    <div className="pb-10">
      {statuses.map((s) => {
        const list = tasks
          .filter((t) => t.statusId === s.id)
          .sort((a, b) => a.position - b.position);
        if (list.length === 0) return null;
        const isCollapsed = collapsed.has(s.id);
        return (
          <section key={s.id}>
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
              className="bg-surface border-border hover:bg-elevated sticky top-[121px] z-10 flex h-9 w-full items-center gap-2 border-b px-4 text-left text-[13px] font-medium sm:px-8 lg:top-[109px]"
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
            {!isCollapsed && (
              <ul>
                {list.map((t) => (
                  <Row key={t.id} task={t} status={s} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
