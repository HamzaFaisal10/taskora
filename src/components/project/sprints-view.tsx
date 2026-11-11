"use client";

import {
  addDays,
  differenceInCalendarDays,
  format,
  formatISO,
  isAfter,
  parseISO,
  startOfDay,
} from "date-fns";
import { CalendarClock, Flag, Plus, Rocket, Timer } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { PriorityIcon, StatusDot } from "@/components/tasks/task-meta";
import { DueLabel } from "@/components/tasks/due-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { Card, EmptyState, Progress } from "@/components/ui/surface";
import { completeSprint, createSprint, startSprint } from "@/lib/project/manage-actions";
import type { BoardTask, Sprint } from "@/lib/project/types";
import { cn } from "@/lib/utils";
import { PersonAvatar, statusGroup } from "./pickers";
import { isDoneCategory, useProject } from "./store";

const points = (t: BoardTask) => t.estimate ?? 1;
const iso = (d: Date) => formatISO(d, { representation: "date" });

/* ------------------------------- Burndown -------------------------------- */

function Burndown({ sprint, tasks }: { sprint: Sprint; tasks: BoardTask[] }) {
  const { statusById } = useProject();
  const start = parseISO(sprint.startDate);
  const end = parseISO(sprint.endDate);
  const days = differenceInCalendarDays(end, start) + 1;
  const total = tasks.reduce((n, t) => n + points(t), 0);
  const today = startOfDay(new Date());

  const actual: { day: number; remaining: number }[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(start, i);
    if (isAfter(day, today)) break;
    const endOfDay = addDays(day, 1);
    const burned = tasks
      .filter(
        (t) =>
          isDoneCategory(statusById.get(t.statusId)?.category ?? "") &&
          t.completedAt &&
          parseISO(t.completedAt) < endOfDay,
      )
      .reduce((n, t) => n + points(t), 0);
    actual.push({ day: i, remaining: total - burned });
  }

  const W = 560;
  const H = 180;
  const pad = { l: 30, r: 10, t: 10, b: 24 };
  const x = (d: number) => pad.l + (d / Math.max(1, days - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / Math.max(1, total)) * (H - pad.t - pad.b);
  const path = actual
    .map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)},${y(p.remaining).toFixed(1)}`)
    .join(" ");
  const last = actual.at(-1);
  const ticks = [0, Math.round(total / 2), total];

  return (
    <figure className="min-w-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Burndown: ${last?.remaining ?? total} of ${total} points remaining`}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line
              x1={pad.l}
              x2={W - pad.r}
              y1={y(v)}
              y2={y(v)}
              className="stroke-border"
              strokeDasharray={v === 0 ? undefined : "2 4"}
            />
            <text x={pad.l - 6} y={y(v) + 3.5} textAnchor="end" className="fill-subtle text-[10px]">
              {v}
            </text>
          </g>
        ))}
        <line
          x1={x(0)}
          y1={y(total)}
          x2={x(days - 1)}
          y2={y(0)}
          className="stroke-subtle"
          strokeDasharray="4 4"
          strokeWidth={1.5}
        />
        {path && (
          <path
            d={path}
            fill="none"
            className="stroke-accent"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {last && <circle cx={x(last.day)} cy={y(last.remaining)} r={4} className="fill-accent" />}
        <text x={x(0)} y={H - 6} className="fill-subtle text-[10px]">
          {format(start, "MMM d")}
        </text>
        <text x={x(days - 1)} y={H - 6} textAnchor="end" className="fill-subtle text-[10px]">
          {format(end, "MMM d")}
        </text>
      </svg>
      <figcaption className="text-subtle mt-1 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="bg-accent h-0.5 w-4 rounded" aria-hidden />
          Remaining points
        </span>
        <span className="flex items-center gap-1.5">
          <span className="border-subtle w-4 border-t border-dashed" aria-hidden />
          Ideal
        </span>
      </figcaption>
    </figure>
  );
}

/* ------------------------------- Task rows ------------------------------- */

function SprintTaskRow({ task, sprints }: { task: BoardTask; sprints?: Sprint[] }) {
  const { openTask, statusById, update, canEdit } = useProject();
  const status = statusById.get(task.statusId);
  const done = isDoneCategory(status?.category ?? "");
  return (
    <li className="border-border-subtle hover:bg-surface flex h-11 items-center gap-3 border-b px-4 text-sm last:border-0">
      <PriorityIcon priority={task.priority} />
      {status && <StatusDot color={status.color} group={statusGroup(status.category)} />}
      <button
        type="button"
        onClick={() => openTask(task.ref)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className="text-subtle hidden font-mono text-[11px] sm:inline">{task.ref}</span>
        <span className={cn("truncate", done && "text-muted line-through")}>{task.title}</span>
      </button>
      <DueLabel date={task.dueDate} done={done} className="hidden sm:inline" />
      <span className="text-subtle w-8 text-right text-xs tabular-nums" title="Points">
        {task.estimate ?? "–"}
      </span>
      {sprints && canEdit && (
        <select
          aria-label={`Add ${task.ref} to a sprint`}
          value=""
          onChange={(e) => e.target.value && update(task.id, { sprintId: e.target.value })}
          className="border-border bg-card rounded-control h-7 max-w-28 border px-1.5 text-xs"
        >
          <option value="">Add to…</option>
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      <PersonAvatar id={task.assigneeId} size={22} />
    </li>
  );
}

/* -------------------------------- Dialogs -------------------------------- */

function NewSprintDialog({
  open,
  onOpenChange,
  suggestedName,
  suggestedStart,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  suggestedName: string;
  suggestedStart: Date;
}) {
  const { project, basePath } = useProject();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const submit = (form: FormData) =>
    start(async () => {
      const res = await createSprint({
        path: basePath,
        projectId: project.id,
        name: String(form.get("name")),
        goal: String(form.get("goal")),
        startDate: String(form.get("start")),
        endDate: String(form.get("end")),
      });
      if (!res.ok) return setError(res.error);
      toast.success("Sprint created");
      onOpenChange(false);
    });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={submit}>
          <DialogHeader>
            <DialogTitle>New sprint</DialogTitle>
            <DialogDescription>
              Plan a fixed window of work. Most teams use one or two weeks.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sprint-name">Name</Label>
              <Input id="sprint-name" name="name" defaultValue={suggestedName} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sprint-goal">Sprint goal</Label>
              <Textarea
                id="sprint-goal"
                name="goal"
                placeholder="What should be true when this sprint ends?"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sprint-start">Starts</Label>
                <Input
                  id="sprint-start"
                  name="start"
                  type="date"
                  defaultValue={iso(suggestedStart)}
                  required
                  className="[color-scheme:light_dark]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sprint-end">Ends</Label>
                <Input
                  id="sprint-end"
                  name="end"
                  type="date"
                  defaultValue={iso(addDays(suggestedStart, 13))}
                  required
                  className="[color-scheme:light_dark]"
                />
              </div>
            </div>
            <FieldError>{error}</FieldError>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Create sprint
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CompleteSprintDialog({
  sprint,
  unfinished,
  next,
  open,
  onOpenChange,
}: {
  sprint: Sprint;
  unfinished: BoardTask[];
  next: Sprint[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { basePath } = useProject();
  const [moveTo, setMoveTo] = useState<string>(next[0]?.id ?? "");
  const [pending, start] = useTransition();
  const finish = () =>
    start(async () => {
      const res = await completeSprint({
        path: basePath,
        sprintId: sprint.id,
        moveTo: moveTo || null,
        unfinishedIds: unfinished.map((t) => t.id),
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${sprint.name} completed`);
      onOpenChange(false);
    });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Complete {sprint.name}?</DialogTitle>
          <DialogDescription>
            {unfinished.length === 0
              ? "Every task in this sprint is done. Nice work."
              : `${unfinished.length} ${unfinished.length === 1 ? "task isn't" : "tasks aren't"} finished yet.`}
          </DialogDescription>
        </DialogHeader>
        {unfinished.length > 0 && (
          <DialogBody className="space-y-1.5">
            <Label htmlFor="move-to">Move unfinished tasks to</Label>
            <select
              id="move-to"
              value={moveTo}
              onChange={(e) => setMoveTo(e.target.value)}
              className="border-border bg-card rounded-control h-10 w-full border px-2.5 text-sm"
            >
              {next.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="">Backlog (no sprint)</option>
            </select>
          </DialogBody>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={finish} loading={pending}>
            Complete sprint
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- View ---------------------------------- */

export function SprintsView() {
  const { sprints, allTasks, statusById, canEdit, basePath } = useProject();
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [pending, start] = useTransition();

  const active = sprints.find((s) => s.state === "active");
  const planned = sprints.filter((s) => s.state === "planned");
  const completed = sprints.filter((s) => s.state === "completed").reverse();
  const tasksOf = (id: string) => allTasks.filter((t) => t.sprintId === id);
  const isDone = (t: BoardTask) => isDoneCategory(statusById.get(t.statusId)?.category ?? "");

  const backlog = useMemo(
    () =>
      allTasks.filter(
        (t) => !t.sprintId && !isDoneCategory(statusById.get(t.statusId)?.category ?? ""),
      ),
    [allTasks, statusById],
  );

  const lastSprint = sprints.at(-1);
  const nextNumber =
    (sprints
      .map((s) => Number(s.name.match(/(\d+)\s*$/)?.[1] ?? 0))
      .reduce((a, b) => Math.max(a, b), 0) || 0) + 1;
  const suggestedStart = lastSprint ? addDays(parseISO(lastSprint.endDate), 1) : new Date();

  const begin = (id: string) =>
    start(async () => {
      const res = await startSprint({ path: basePath, sprintId: id });
      if (!res.ok) toast.error(res.error);
      else toast.success("Sprint started");
    });

  if (sprints.length === 0) {
    return (
      <>
        <EmptyState
          icon={<Rocket />}
          title="No sprints yet"
          description="Sprints group work into short, focused windows with a goal and a burndown."
          action={
            canEdit && (
              <Button onClick={() => setCreating(true)}>
                <Plus /> Plan the first sprint
              </Button>
            )
          }
        />
        <NewSprintDialog
          open={creating}
          onOpenChange={setCreating}
          suggestedName="Sprint 1"
          suggestedStart={new Date()}
        />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 pb-12 sm:px-8">
      {active ? (
        (() => {
          const tasks = tasksOf(active.id);
          const doneTasks = tasks.filter(isDone);
          const total = tasks.reduce((n, t) => n + points(t), 0);
          const burned = doneTasks.reduce((n, t) => n + points(t), 0);
          const left = differenceInCalendarDays(parseISO(active.endDate), new Date());
          return (
            <section aria-labelledby="active-sprint">
              <Card className="overflow-hidden p-0">
                <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone="accent">Active</Badge>
                      <span className="text-subtle text-xs">
                        {format(parseISO(active.startDate), "MMM d")} –{" "}
                        {format(parseISO(active.endDate), "MMM d")}
                      </span>
                    </div>
                    <h2 id="active-sprint" className="mt-2 text-xl font-semibold tracking-tight">
                      {active.name}
                    </h2>
                    {active.goal && (
                      <p className="text-fg-2 mt-1.5 text-sm leading-relaxed">
                        <Flag
                          className="text-accent-text mr-1.5 inline size-3.5 align-[-2px]"
                          aria-hidden
                        />
                        {active.goal}
                      </p>
                    )}
                    <dl className="mt-5 grid grid-cols-3 gap-3">
                      <div>
                        <dt className="text-subtle text-xs">Done</dt>
                        <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                          {doneTasks.length}/{tasks.length}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-subtle text-xs">Points</dt>
                        <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                          {burned}/{total}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-subtle text-xs">Time left</dt>
                        <dd
                          className={cn(
                            "mt-0.5 text-lg font-semibold tabular-nums",
                            left < 0 && "text-danger-text",
                          )}
                        >
                          {left < 0 ? `${-left}d over` : left === 0 ? "Last day" : `${left}d`}
                        </dd>
                      </div>
                    </dl>
                    <Progress value={total ? (burned / total) * 100 : 0} className="mt-4" />
                    {canEdit && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-5"
                        onClick={() => setCompleting(true)}
                      >
                        Complete sprint
                      </Button>
                    )}
                  </div>
                  <Burndown sprint={active} tasks={tasks} />
                </div>
                <ul className="border-border border-t">
                  {tasks
                    .sort(
                      (a, b) =>
                        Number(isDone(a)) - Number(isDone(b)) ||
                        (statusById.get(b.statusId)?.position ?? 0) -
                          (statusById.get(a.statusId)?.position ?? 0),
                    )
                    .map((t) => (
                      <SprintTaskRow key={t.id} task={t} />
                    ))}
                </ul>
              </Card>
              <CompleteSprintDialog
                sprint={active}
                unfinished={tasks.filter((t) => !isDone(t))}
                next={planned}
                open={completing}
                onOpenChange={setCompleting}
              />
            </section>
          );
        })()
      ) : (
        <Card className="flex flex-wrap items-center gap-3 p-4">
          <Timer className="text-muted size-5" aria-hidden />
          <p className="text-sm">
            No sprint is running.{planned[0] && ` Start ${planned[0].name} when the team is ready.`}
          </p>
          {planned[0] && canEdit && (
            <Button
              size="sm"
              className="ml-auto"
              loading={pending}
              onClick={() => begin(planned[0].id)}
            >
              Start {planned[0].name}
            </Button>
          )}
        </Card>
      )}

      <section aria-labelledby="upcoming">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="upcoming" className="text-[13px] font-semibold">
            Upcoming
          </h2>
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={() => setCreating(true)}>
              <Plus /> New sprint
            </Button>
          )}
        </div>
        {planned.length === 0 ? (
          <p className="text-subtle text-sm">No sprints planned.</p>
        ) : (
          <div className="space-y-3">
            {planned.map((s) => {
              const tasks = tasksOf(s.id);
              return (
                <Card key={s.id} className="overflow-hidden p-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                    <h3 className="text-sm font-semibold">{s.name}</h3>
                    <span className="text-subtle flex items-center gap-1 text-xs">
                      <CalendarClock className="size-3.5" aria-hidden />
                      {format(parseISO(s.startDate), "MMM d")} –{" "}
                      {format(parseISO(s.endDate), "MMM d")}
                    </span>
                    <span className="text-subtle text-xs">
                      {tasks.length} tasks · {tasks.reduce((n, t) => n + points(t), 0)} pts
                    </span>
                    {!active && canEdit && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="ml-auto"
                        loading={pending}
                        onClick={() => begin(s.id)}
                      >
                        Start
                      </Button>
                    )}
                  </div>
                  {s.goal && <p className="text-muted -mt-1 px-4 pb-3 text-[13px]">{s.goal}</p>}
                  {tasks.length > 0 && (
                    <ul className="border-border border-t">
                      {tasks.map((t) => (
                        <SprintTaskRow key={t.id} task={t} />
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="backlog">
        <h2 id="backlog" className="mb-3 text-[13px] font-semibold">
          Backlog <span className="text-subtle font-normal">{backlog.length}</span>
        </h2>
        {backlog.length === 0 ? (
          <p className="text-subtle text-sm">Every open task is planned into a sprint.</p>
        ) : (
          <Card className="overflow-hidden p-0">
            <ul>
              {backlog.slice(0, 30).map((t) => (
                <SprintTaskRow
                  key={t.id}
                  task={t}
                  sprints={[...(active ? [active] : []), ...planned]}
                />
              ))}
            </ul>
            {backlog.length > 30 && (
              <p className="text-subtle border-border border-t px-4 py-2.5 text-xs">
                +{backlog.length - 30} more in the List view
              </p>
            )}
          </Card>
        )}
      </section>

      {completed.length > 0 && (
        <section aria-labelledby="completed">
          <h2 id="completed" className="mb-3 text-[13px] font-semibold">
            Completed
          </h2>
          <Card className="divide-border-subtle divide-y p-0">
            {completed.map((s) => {
              const tasks = tasksOf(s.id);
              const velocity = tasks.filter(isDone).reduce((n, t) => n + points(t), 0);
              return (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-subtle text-xs">
                    {format(parseISO(s.startDate), "MMM d")} –{" "}
                    {format(parseISO(s.endDate), "MMM d")}
                  </span>
                  <span className="text-muted ml-auto text-xs">
                    {tasks.filter(isDone).length} tasks ·{" "}
                    <span className="text-fg font-medium">{velocity} pts</span> delivered
                  </span>
                </div>
              );
            })}
          </Card>
        </section>
      )}

      <NewSprintDialog
        open={creating}
        onOpenChange={setCreating}
        suggestedName={`Sprint ${nextNumber}`}
        suggestedStart={suggestedStart}
      />
    </div>
  );
}
