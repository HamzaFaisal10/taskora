"use client";

import { CheckSquare, MessageSquare, Repeat } from "lucide-react";
import { DueLabel } from "@/components/tasks/due-label";
import { PriorityIcon } from "@/components/tasks/task-meta";
import type { BoardTask } from "@/lib/project/types";
import { cn } from "@/lib/utils";
import { AssigneePicker, LabelChips, PersonAvatar, PriorityPicker } from "./pickers";
import { isDoneCategory, useProject } from "./store";

export function TaskCard({
  task,
  dragging,
  overlay,
}: {
  task: BoardTask;
  dragging?: boolean;
  overlay?: boolean;
}) {
  const { openTask, statusById } = useProject();
  const done = isDoneCategory(statusById.get(task.statusId)?.category ?? "");
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      role="button"
      tabIndex={-1}
      onClick={() => openTask(task.ref)}
      className={cn(
        "group bg-card border-border hover:border-fg/20 rounded-card cursor-pointer border p-3 text-left shadow-[0_1px_0_rgb(0_0_0/0.04)] transition-colors select-none",
        dragging && "opacity-40",
        overlay && "shadow-pop rotate-[1.5deg] cursor-grabbing",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-subtle font-mono text-[11px]">{task.ref}</span>
        <span className="ml-auto" onPointerDown={stop} onClick={stop}>
          <PriorityPicker task={task} align="end">
            <button
              type="button"
              className="hover:bg-elevated rounded p-0.5"
              aria-label="Change priority"
            >
              <PriorityIcon priority={task.priority} />
            </button>
          </PriorityPicker>
        </span>
      </div>
      <p
        className={cn(
          "mt-1 text-[13.5px] leading-snug font-medium",
          done && "text-muted line-through",
        )}
      >
        {task.title}
      </p>
      {task.labelIds.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          <LabelChips ids={task.labelIds} />
        </div>
      )}
      <div className="text-subtle mt-2.5 flex items-center gap-3 text-xs">
        {task.subtasks.total > 0 && (
          <span
            className={cn(
              "flex items-center gap-1",
              task.subtasks.done === task.subtasks.total && "text-success-text",
            )}
          >
            <CheckSquare className="size-3.5" aria-hidden />
            {task.subtasks.done}/{task.subtasks.total}
          </span>
        )}
        {task.comments > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="size-3.5" aria-hidden />
            {task.comments}
          </span>
        )}
        <DueLabel date={task.dueDate} done={done} />
        {task.recurring && (
          <span title="Repeats" className="flex items-center">
            <Repeat className="size-3.5" aria-label="Repeats" />
          </span>
        )}
        <span className="ml-auto" onPointerDown={stop} onClick={stop}>
          <AssigneePicker task={task} align="end">
            <button type="button" className="rounded-full" aria-label="Change assignee">
              <PersonAvatar id={task.assigneeId} />
            </button>
          </AssigneePicker>
        </span>
      </div>
    </div>
  );
}
