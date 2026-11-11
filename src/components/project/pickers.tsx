"use client";

import { Check, Tag, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import {
  PRIORITY_META,
  PriorityIcon,
  StatusDot,
  type Priority,
  type StatusGroup,
} from "@/components/tasks/task-meta";
import type { BoardTask } from "@/lib/project/types";
import { cn } from "@/lib/utils";
import { useProject } from "./store";

export const statusGroup = (category: string): StatusGroup =>
  category === "triage" ? "backlog" : (category as StatusGroup);

const TONE_TEXT: Record<string, string> = {
  neutral: "!text-muted",
  accent: "!text-accent-text",
  info: "!text-info-text",
  success: "!text-success-text",
  warning: "!text-warning-text",
  danger: "!text-danger-text",
  violet: "!text-violet-text",
  pink: "!text-pink-text",
};

const PRIORITIES: Priority[] = ["urgent", "high", "medium", "low", "none"];

type TriggerProps = {
  task: BoardTask;
  children: React.ReactNode;
  align?: "start" | "end";
  disabled?: boolean;
};

export function StatusPicker({ task, children, align = "start" }: TriggerProps) {
  const { statuses, update, canEdit } = useProject();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={!canEdit}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-52" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        {statuses.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onSelect={() => s.id !== task.statusId && update(task.id, { statusId: s.id })}
          >
            <StatusDot color={s.color} group={statusGroup(s.category)} />
            <span className="flex-1">{s.name}</span>
            {s.id === task.statusId && <Check className="!text-accent-text" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PriorityPicker({ task, children, align = "start" }: TriggerProps) {
  const { update, canEdit } = useProject();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={!canEdit}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-48" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>Priority</DropdownMenuLabel>
        {PRIORITIES.map((p) => (
          <DropdownMenuItem
            key={p}
            onSelect={() => p !== task.priority && update(task.id, { priority: p })}
          >
            <PriorityIcon priority={p} />
            <span className="flex-1">{PRIORITY_META[p].label}</span>
            {p === task.priority && <Check className="!text-accent-text" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AssigneePicker({ task, children, align = "start" }: TriggerProps) {
  const { people, update, canEdit } = useProject();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={!canEdit}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="max-h-80 w-56 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuLabel>Assignee</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => task.assigneeId && update(task.id, { assigneeId: null })}>
          <UserRound />
          <span className="flex-1">Unassigned</span>
          {!task.assigneeId && <Check className="!text-accent-text" />}
        </DropdownMenuItem>
        {people.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onSelect={() => p.id !== task.assigneeId && update(task.id, { assigneeId: p.id })}
          >
            <Avatar name={p.name} src={p.avatarUrl} seed={p.id} size={18} />
            <span className="flex-1 truncate">{p.name}</span>
            {p.id === task.assigneeId && <Check className="!text-accent-text" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LabelPicker({ task, children, align = "start" }: TriggerProps) {
  const { labels, setLabels, canEdit } = useProject();
  const toggle = (id: string) =>
    setLabels(
      task.id,
      task.labelIds.includes(id) ? task.labelIds.filter((l) => l !== id) : [...task.labelIds, id],
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={!canEdit}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="max-h-80 w-52 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuLabel>Labels</DropdownMenuLabel>
        {labels.length === 0 && (
          <p className="text-subtle px-2 py-1.5 text-xs">No labels in this workspace.</p>
        )}
        {labels.map((l) => (
          <DropdownMenuCheckboxItem
            key={l.id}
            checked={task.labelIds.includes(l.id)}
            onSelect={(e) => {
              e.preventDefault();
              toggle(l.id);
            }}
          >
            <Tag className={cn("size-3.5", TONE_TEXT[l.tone])} />
            {l.name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LabelChips({ ids, max = 3 }: { ids: string[]; max?: number }) {
  const { labels } = useProject();
  const shown = labels.filter((l) => ids.includes(l.id));
  if (shown.length === 0) return null;
  return (
    <>
      {shown.slice(0, max).map((l) => (
        <Badge key={l.id} tone={l.tone as BadgeTone} shape="tag">
          {l.name}
        </Badge>
      ))}
      {shown.length > max && <Badge shape="tag">+{shown.length - max}</Badge>}
    </>
  );
}

export function PersonAvatar({ id, size = 22 }: { id: string | null; size?: number }) {
  const { people } = useProject();
  const p = people.find((x) => x.id === id);
  if (!p) {
    return (
      <span
        className="border-border text-subtle inline-flex shrink-0 items-center justify-center rounded-full border border-dashed"
        style={{ width: size, height: size }}
        aria-label="Unassigned"
      >
        <UserRound className="size-3" aria-hidden />
      </span>
    );
  }
  return <Avatar name={p.name} src={p.avatarUrl} seed={p.id} size={size} />;
}
