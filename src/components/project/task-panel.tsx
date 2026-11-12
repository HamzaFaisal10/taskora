"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { formatDistanceToNowStrict, parseISO, format } from "date-fns";
import {
  Archive,
  CalendarDays,
  CalendarRange,
  CircleDot,
  Gauge,
  Hash,
  Repeat,
  Link2,
  Loader2,
  MoreHorizontal,
  Plus,
  Tag,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { PRIORITY_META, PriorityIcon, StatusDot } from "@/components/tasks/task-meta";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/surface";
import { addComment } from "@/lib/project/actions";
import { useLive } from "@/lib/realtime/use-live";
import { AiAssist } from "./ai-assist";
import { DescriptionEditor } from "./rich-text";
import { FieldValueEditor, fieldIcon, RepeatField } from "./custom-fields";
import { BlockersSection } from "./blockers";
import { CommentBody, MentionInput, Reactions } from "./comments";
import { AttachmentsSection } from "./attachments-section";
import { TimeSection } from "./time-section";
import type { TaskDetail } from "@/lib/project/types";
import { cn } from "@/lib/utils";
import {
  AssigneePicker,
  LabelChips,
  LabelPicker,
  PersonAvatar,
  PriorityPicker,
  StatusPicker,
  statusGroup,
} from "./pickers";
import { isDoneCategory, useProject } from "./store";

function Property({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-9 grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2">
      <span className="text-subtle flex items-center gap-2 text-[13px]">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

const valueButton =
  "hover:bg-elevated rounded-control -ml-2 flex h-8 max-w-full items-center gap-2 px-2 text-left text-[13px] disabled:hover:bg-transparent";

function DateField({
  value,
  onChange,
  label,
  disabled,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="date"
        value={value ?? ""}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(e.target.value || null)}
        className={cn(
          "hover:bg-elevated rounded-control -ml-2 h-8 bg-transparent px-2 text-[13px] [color-scheme:light_dark] outline-none",
          !value && "text-subtle",
        )}
      />
      {value && !disabled && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-subtle hover:text-fg rounded p-1"
          aria-label={`Clear ${label.toLowerCase()}`}
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

/** "3 hours ago", never "in 1 second" when the server clock is slightly ahead. */
function ago(iso: string) {
  const d = parseISO(iso);
  return Date.now() - d.getTime() < 45_000
    ? "just now"
    : formatDistanceToNowStrict(d, { addSuffix: true });
}

const ACTIVITY: Record<string, string> = {
  created: "created the task",
  status_changed: "changed the status",
  priority_changed: "changed the priority",
  due_changed: "changed the due date",
  assignee_changed: "changed the assignee",
  commented: "commented",
};

function AutoTextarea({
  value,
  onCommit,
  className,
  placeholder,
  disabled,
  ariaLabel,
  singleLine,
  maxLength,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel: string;
  singleLine?: boolean;
  maxLength?: number;
}) {
  const [draft, setDraft] = useState(value);
  const [prev, setPrev] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  if (value !== prev) {
    setPrev(value);
    setDraft(value);
  }
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);
  return (
    <textarea
      ref={ref}
      value={draft}
      rows={1}
      disabled={disabled}
      aria-label={ariaLabel}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => setDraft(singleLine ? e.target.value.replace(/\n/g, "") : e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        if (singleLine && e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
        if (e.key === "Escape") {
          setDraft(value);
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      className={cn(
        "placeholder:text-subtle w-full resize-none overflow-hidden bg-transparent outline-none",
        className,
      )}
    />
  );
}

function PanelBody({
  detail,
  reload,
  partial = false,
}: {
  detail: TaskDetail;
  reload: () => void;
  partial?: boolean;
}) {
  const store = useProject();
  const {
    statuses,
    statusById,
    people,
    sprints,
    canEdit,
    basePath,
    update,
    archive,
    openTask,
    create,
    fields,
  } = store;
  const [local, setTask] = useState(detail);
  const [prevDetail, setPrevDetail] = useState(detail);
  // A description being saved wins over a reload that raced ahead of the save.
  const [pendingDescription, setPendingDescription] = useState<string | null>(null);
  if (detail !== prevDetail) {
    setPrevDetail(detail);
    const keepPending = pendingDescription !== null && detail.description !== pendingDescription;
    if (!keepPending) setPendingDescription(null);
    setTask(keepPending ? { ...detail, description: pendingDescription } : detail);
  }
  // Board-level fields update optimistically in the store; prefer them so pickers feel instant.
  const live = store.allTasks.find((t) => t.id === local.id);
  const task = live
    ? {
        ...local,
        title: live.title,
        statusId: live.statusId,
        priority: live.priority,
        assigneeId: live.assigneeId,
        labelIds: live.labelIds,
        startDate: live.startDate,
        dueDate: live.dueDate,
        estimate: live.estimate,
        sprintId: live.sprintId,
      }
    : local;
  const [comment, setComment] = useState("");
  const [subtask, setSubtask] = useState("");
  const [posting, startPosting] = useTransition();

  const status = statusById.get(task.statusId);
  const assignee = people.find((p) => p.id === task.assigneeId);
  const sprint = sprints.find((s) => s.id === task.sprintId);
  const doneStatus = statuses.find((s) => s.category === "completed");
  const todoStatus = statuses.find((s) => s.category === "unstarted") ?? statuses[0];

  const patch = (p: Parameters<typeof update>[1]) => {
    if (p.description !== undefined) setPendingDescription(p.description);
    setTask((t) => ({ ...t, ...p }));
    update(task.id, p);
  };

  const postComment = () =>
    startPosting(async () => {
      const res = await addComment({ path: basePath, taskId: task.id, body: comment });
      if (!res.ok) return void toast.error(res.error);
      setComment("");
      reload();
    });

  const addSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subtask.trim()) return;
    const title = subtask.trim();
    setSubtask("");
    await create(title, { parentId: task.id, statusId: todoStatus?.id });
    reload();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-border flex h-12 shrink-0 items-center gap-2 border-b px-4">
        {task.parent && (
          <button
            type="button"
            onClick={() => openTask(task.parent!.ref)}
            className="text-muted hover:text-fg max-w-48 truncate text-xs"
          >
            {task.parent.ref} ›
          </button>
        )}
        <span className="text-subtle font-mono text-xs">{task.ref}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Copy link"
            onClick={() =>
              navigator.clipboard.writeText(location.href).then(() => toast.success("Link copied"))
            }
          >
            <Link2 />
          </Button>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  destructive
                  onSelect={() => {
                    archive(task.id);
                    openTask(null);
                    toast.success(`${task.ref} archived`);
                  }}
                >
                  <Archive /> Archive task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Close">
              <X />
            </Button>
          </DialogPrimitive.Close>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <DialogPrimitive.Title asChild>
          <AutoTextarea
            value={task.title}
            singleLine
            disabled={!canEdit}
            ariaLabel="Task title"
            maxLength={300}
            onCommit={(v) => v.trim() && patch({ title: v.trim() })}
            className="text-xl leading-snug font-semibold tracking-tight"
          />
        </DialogPrimitive.Title>

        <div className="mt-4 space-y-0.5">
          <Property icon={CircleDot} label="Status">
            <StatusPicker task={task}>
              <button type="button" className={valueButton} disabled={!canEdit}>
                {status && <StatusDot color={status.color} group={statusGroup(status.category)} />}
                {status?.name}
              </button>
            </StatusPicker>
          </Property>
          <Property icon={Zap} label="Priority">
            <PriorityPicker task={task}>
              <button type="button" className={valueButton} disabled={!canEdit}>
                <PriorityIcon priority={task.priority} />
                {PRIORITY_META[task.priority].label}
              </button>
            </PriorityPicker>
          </Property>
          <Property icon={UserRound} label="Assignee">
            <AssigneePicker task={task}>
              <button type="button" className={valueButton} disabled={!canEdit}>
                <PersonAvatar id={task.assigneeId} size={20} />
                <span className={cn("truncate", !assignee && "text-subtle")}>
                  {assignee?.name ?? "Unassigned"}
                </span>
              </button>
            </AssigneePicker>
          </Property>
          <Property icon={Tag} label="Labels">
            <LabelPicker task={task}>
              <button
                type="button"
                className={cn(valueButton, "flex-wrap py-1")}
                disabled={!canEdit}
              >
                {task.labelIds.length ? (
                  <LabelChips ids={task.labelIds} max={6} />
                ) : (
                  <span className="text-subtle">Add labels</span>
                )}
              </button>
            </LabelPicker>
          </Property>
          <Property icon={CalendarRange} label="Start date">
            <DateField
              label="Start date"
              value={task.startDate}
              disabled={!canEdit}
              onChange={(v) => patch({ startDate: v })}
            />
          </Property>
          <Property icon={CalendarDays} label="Due date">
            <DateField
              label="Due date"
              value={task.dueDate}
              disabled={!canEdit}
              onChange={(v) => patch({ dueDate: v })}
            />
          </Property>
          <Property icon={Gauge} label="Estimate">
            <select
              value={task.estimate ?? ""}
              disabled={!canEdit}
              aria-label="Estimate in points"
              onChange={(e) =>
                patch({ estimate: e.target.value === "" ? null : Number(e.target.value) })
              }
              className={cn(
                "hover:bg-elevated rounded-control -ml-2 h-8 bg-transparent px-1.5 text-[13px] outline-none",
                task.estimate == null && "text-subtle",
              )}
            >
              <option value="">No estimate</option>
              {[1, 2, 3, 5, 8, 13].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "point" : "points"}
                </option>
              ))}
            </select>
          </Property>
          {sprints.length > 0 && (
            <Property icon={Hash} label="Sprint">
              <select
                value={task.sprintId ?? ""}
                disabled={!canEdit}
                aria-label="Sprint"
                onChange={(e) => patch({ sprintId: e.target.value || null })}
                className={cn(
                  "hover:bg-elevated rounded-control -ml-2 h-8 max-w-full bg-transparent px-1.5 text-[13px] outline-none",
                  !sprint && "text-subtle",
                )}
              >
                <option value="">No sprint</option>
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.state === "active" ? " (active)" : s.state === "completed" ? " (done)" : ""}
                  </option>
                ))}
              </select>
            </Property>
          )}
          {!task.parent && !partial && (
            <Property icon={Repeat} label="Repeat">
              <RepeatField
                taskId={task.id}
                value={task.recurrence}
                disabled={!canEdit}
                onSaved={(r) => setTask((t) => ({ ...t, recurrence: r, recurring: !!r }))}
              />
            </Property>
          )}
          {!partial &&
            fields.map((f) => (
              <Property key={f.id} icon={fieldIcon(f.kind)} label={f.name}>
                <FieldValueEditor
                  key={`${task.id}:${f.id}`}
                  taskId={task.id}
                  field={f}
                  value={task.fieldValues[f.id]}
                  disabled={!canEdit}
                  onSaved={(v) =>
                    setTask((t) => {
                      const fieldValues = { ...t.fieldValues };
                      if (v === null) delete fieldValues[f.id];
                      else fieldValues[f.id] = v;
                      return { ...t, fieldValues };
                    })
                  }
                />
              </Property>
            ))}
        </div>

        {!partial && (
          <AiAssist
            taskId={task.id}
            number={task.number}
            hasDescription={task.description.trim().length > 0}
            onUseDescription={(text) => patch({ description: text })}
            onSubtasksAdded={reload}
          />
        )}

        <section className="mt-6">
          <h3 className="text-subtle mb-1.5 text-xs font-medium tracking-wide uppercase">
            Description
          </h3>
          {partial ? (
            <div className="space-y-2 py-1.5" aria-hidden>
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
            </div>
          ) : (
            <DescriptionEditor
              value={task.description}
              disabled={!canEdit}
              placeholder="Add more detail, acceptance criteria or links…"
              onCommit={(v) => patch({ description: v })}
            />
          )}
        </section>

        {partial ? (
          <div className="mt-8 space-y-3" aria-busy>
            <span className="sr-only">Loading subtasks and comments</span>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="mt-6 h-3 w-24" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (
          <>
            <BlockersSection task={task} reload={reload} />

            <section className="mt-6">
              <h3 className="text-subtle mb-2 flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                Subtasks
                {task.children.length > 0 && (
                  <span className="normal-case">
                    {
                      task.children.filter((c) =>
                        isDoneCategory(statusById.get(c.statusId)?.category ?? ""),
                      ).length
                    }
                    /{task.children.length}
                  </span>
                )}
              </h3>
              <ul className="space-y-0.5">
                {task.children.map((c) => {
                  const s = statusById.get(c.statusId);
                  const done = isDoneCategory(s?.category ?? "");
                  return (
                    <li
                      key={c.id}
                      className="hover:bg-surface rounded-control flex items-center gap-2.5 px-2 py-1.5"
                    >
                      <Checkbox
                        checked={done}
                        disabled={!canEdit}
                        aria-label={done ? `Mark ${c.ref} as not done` : `Mark ${c.ref} as done`}
                        onCheckedChange={(v) => {
                          const target = v ? doneStatus : todoStatus;
                          if (!target) return;
                          setTask((t) => ({
                            ...t,
                            children: t.children.map((x) =>
                              x.id === c.id ? { ...x, statusId: target.id } : x,
                            ),
                          }));
                          update(c.id, { statusId: target.id });
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => openTask(c.ref)}
                        className={cn(
                          "min-w-0 flex-1 truncate text-left text-sm",
                          done && "text-muted line-through",
                        )}
                      >
                        {c.title}
                      </button>
                      <PersonAvatar id={c.assigneeId} size={18} />
                    </li>
                  );
                })}
              </ul>
              {canEdit && (
                <form onSubmit={addSubtask} className="mt-1 flex items-center gap-2.5 px-2">
                  <Plus className="text-subtle size-4" aria-hidden />
                  <input
                    value={subtask}
                    onChange={(e) => setSubtask(e.target.value)}
                    placeholder="Add subtask"
                    maxLength={300}
                    aria-label="New subtask title"
                    className="placeholder:text-subtle h-8 flex-1 bg-transparent text-sm outline-none"
                  />
                </form>
              )}
            </section>

            <AttachmentsSection task={task} reload={reload} />

            <TimeSection task={task} reload={reload} />

            <section className="border-border mt-8 border-t pt-5">
              <h3 className="text-subtle mb-3 text-xs font-medium tracking-wide uppercase">
                Comments
              </h3>
              <ul className="space-y-4">
                {task.commentList.map((c) => (
                  <li key={c.id} className="flex gap-3">
                    <Avatar
                      name={c.author?.name ?? "Former member"}
                      src={c.author?.avatarUrl}
                      seed={c.author?.id}
                      size={28}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px]">
                        <span className="font-medium">{c.author?.name ?? "Former member"}</span>{" "}
                        <time className="text-subtle text-xs" dateTime={c.createdAt}>
                          {ago(c.createdAt)}
                        </time>
                      </p>
                      <CommentBody body={c.body} people={people} />
                      <Reactions
                        commentId={c.id}
                        reactions={c.reactions}
                        people={people}
                        onChange={reload}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <form
                className="bg-card border-border focus-within:border-accent rounded-card mt-4 border p-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (comment.trim()) postComment();
                }}
              >
                <MentionInput
                  value={comment}
                  onChange={setComment}
                  onSubmit={postComment}
                  people={people}
                />
                <div className="flex items-center justify-between">
                  <span className="text-subtle px-1 text-[11px]">⌘ Enter to send</span>
                  <Button type="submit" size="sm" loading={posting} disabled={!comment.trim()}>
                    Comment
                  </Button>
                </div>
              </form>
            </section>

            <section className="mt-8 pb-6">
              <h3 className="text-subtle mb-3 text-xs font-medium tracking-wide uppercase">
                Activity
              </h3>
              <ol className="border-border space-y-3 border-l pl-4">
                {task.activity.map((a) => (
                  <li key={a.id} className="text-muted relative text-[13px]">
                    <span
                      className="bg-border absolute top-1.5 -left-[21px] size-2 rounded-full"
                      aria-hidden
                    />
                    <span className="text-fg font-medium">{a.actor?.name ?? "Taskora"}</span>{" "}
                    {a.action === "automation_ran"
                      ? `ran the “${String(a.meta.name ?? "automation")}” automation`
                      : (ACTIVITY[a.action] ?? a.action.replace(/_/g, " "))}
                    <span className="text-subtle"> · {ago(a.createdAt)}</span>
                  </li>
                ))}
                <li className="text-subtle text-[13px]">
                  Created {format(parseISO(task.createdAt), "MMM d, yyyy")}
                  {task.creator ? ` by ${task.creator.name}` : ""}
                </li>
              </ol>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

type DetailResult = { ok: true; data: TaskDetail } | { ok: false; error: string };

/** Reads go through a GET route so they never wait behind edits in the server-action queue. */
function fetchDetail(projectId: string, number: number): Promise<DetailResult> {
  return fetch(`/api/tasks/${projectId}/${number}`, { cache: "no-store" })
    .then((r) => r.json() as Promise<DetailResult>)
    .catch(() => ({ ok: false, error: "Couldn't load the task. Check your connection." }));
}

function PanelSkeleton() {
  return (
    <div className="space-y-4 p-6" aria-busy>
      <span className="sr-only">Loading task</span>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-7 w-3/4" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}

export function TaskPanel() {
  const { openRef, openTask, project, allTasks } = useProject();
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const number = openRef?.toUpperCase().startsWith(`${project.key}-`)
    ? Number(openRef.split("-")[1])
    : NaN;

  const apply = useCallback((res: DetailResult) => {
    if (res.ok) {
      setDetail(res.data);
      setError(null);
    } else setError(res.error);
    setLoading(false);
  }, []);

  const load = useCallback(() => {
    if (Number.isFinite(number)) fetchDetail(project.id, number).then(apply);
  }, [project.id, number, apply]);

  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  if (Number.isFinite(number) && loadedFor !== number) {
    setLoadedFor(number);
    setLoading(true);
    setDetail(null);
    setError(null);
  }

  // Load on open, and again whenever the project data changes (after any edit).
  useEffect(() => {
    if (!Number.isFinite(number)) return;
    let cancelled = false;
    fetchDetail(project.id, number).then((res) => {
      if (!cancelled) apply(res);
    });
    return () => {
      cancelled = true;
    };
  }, [number, project.id, apply, allTasks]);

  // New comments from teammates appear while the panel is open.
  const liveTaskId = detail?.id;
  useLive(
    `task:${liveTaskId ?? "none"}`,
    liveTaskId ? [{ table: "comments", filter: `task_id=eq.${liveTaskId}` }] : [],
    load,
    300,
  );

  // Open instantly with what the board already knows; comments, subtasks and history fill in after.
  const boardTask = allTasks.find((t) => t.number === number);
  const placeholder: TaskDetail | null = boardTask
    ? {
        ...boardTask,
        description: "",
        recurrence: null,
        fieldValues: {},
        creator: null,
        parent: null,
        children: [],
        blockedBy: [],
        commentList: [],
        activity: [],
        time: [],
        attachments: [],
      }
    : null;

  const open = Boolean(openRef);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && openTask(null)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bg-overlay fixed inset-0 z-40 md:bg-transparent" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          // Escape inside an open editor cancels the edit instead of closing the panel.
          onEscapeKeyDown={(e) => {
            if ((e.target as HTMLElement | null)?.closest?.("[data-escape-local]"))
              e.preventDefault();
          }}
          className="bg-bg border-border shadow-pop md:rounded-dialog fixed inset-0 z-50 flex flex-col outline-none md:inset-y-2 md:right-2 md:left-auto md:w-[min(600px,calc(100vw-1rem))] md:border"
        >
          {loading && !detail && placeholder && (
            <PanelBody key={placeholder.id} detail={placeholder} reload={load} partial />
          )}
          {loading && !detail && !placeholder && <PanelSkeleton />}
          {loading && !detail && !placeholder && (
            <DialogPrimitive.Title className="sr-only">Loading task</DialogPrimitive.Title>
          )}
          {error && (
            <div className="p-6">
              <DialogPrimitive.Title className="font-semibold">
                Task not found
              </DialogPrimitive.Title>
              <p className="text-muted mt-1 text-sm">{error}</p>
              <Button className="mt-4" variant="secondary" onClick={() => openTask(null)}>
                Close
              </Button>
            </div>
          )}
          {detail && <PanelBody detail={detail} reload={load} />}
          {loading && detail && (
            <Loader2
              className="text-subtle absolute top-4 right-28 size-4 animate-spin"
              aria-hidden
            />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
