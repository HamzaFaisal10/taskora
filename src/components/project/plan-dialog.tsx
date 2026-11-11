"use client";

import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PRIORITY_META, PriorityIcon, type Priority } from "@/components/tasks/task-meta";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Select } from "@/components/ui/controls";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label, Textarea } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/menu";
import type { PlanAnswer, PlannedTask } from "@/lib/ai/plan-run";
import { createPlannedTasks } from "@/lib/project/actions";
import { cn } from "@/lib/utils";
import { useProject } from "./store";

const EXAMPLE = `We're launching a referral program next month.

We need a referral page where users can copy their invite link, and we must track sign-ups from each link. Users should be able to see how many friends joined. Send a reward email when a friend upgrades. The API needs a Stripe webhook so rewards are applied ASAP.

Nice to have:
- leaderboard of top referrers
- share buttons for X and LinkedIn
- Write the launch blog post`;

const PRIORITIES: Priority[] = ["urgent", "high", "medium", "low"];
const POINTS = [1, 2, 3, 5, 8];

type Row = PlannedTask & { key: number; on: boolean };

/** "Plan with AI": paste a brief, review the drafted tasks, add the ones you want. */
export function PlanDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { project, statuses, sprints, labels, refresh } = useProject();
  const [brief, setBrief] = useState("");
  const [running, setRunning] = useState(false);
  const [answer, setAnswer] = useState<Omit<PlanAnswer, "tasks"> | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string>();
  const startStatus =
    statuses.find((s) => s.category === "unstarted") ??
    statuses.find((s) => s.category === "backlog") ??
    statuses[0];
  const [statusId, setStatusId] = useState(startStatus?.id ?? "");
  const activeSprint = sprints.find((s) => s.state === "active");
  const [sprintId, setSprintId] = useState("none");
  const [adding, startAdding] = useTransition();

  const reset = () => {
    setAnswer(null);
    setRows([]);
    setError(undefined);
  };

  const generate = async () => {
    setRunning(true);
    setError(undefined);
    const res: { ok: true; data: PlanAnswer } | { ok: false; error: string } = await fetch(
      "/api/ai/plan",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: project.id, brief }),
      },
    )
      .then((r) => r.json())
      .catch(() => ({
        ok: false,
        error: "Couldn't reach the AI assistant. Check your connection.",
      }));
    setRunning(false);
    if (!res.ok) return setError(res.error);
    const { tasks, ...meta } = res.data;
    setAnswer(meta);
    setRows(tasks.map((t, i) => ({ ...t, key: i, on: true })));
  };

  const chosen = rows.filter((r) => r.on && r.title.trim());
  const set = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const add = () =>
    startAdding(async () => {
      const res = await createPlannedTasks({
        projectId: project.id,
        statusId: statusId || null,
        sprintId: sprintId === "none" ? null : sprintId,
        tasks: chosen.map((r) => ({
          title: r.title.trim(),
          priority: r.priority,
          estimate: r.estimate,
          labelIds: r.labelIds,
        })),
      });
      if (!res.ok) return void toast.error(res.error);
      const column = statuses.find((s) => s.id === statusId)?.name ?? "the board";
      toast.success(`Added ${res.data} tasks to ${column}`);
      refresh();
      onOpenChange(false);
      setBrief("");
      reset();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-accent-text size-4" aria-hidden /> Plan tasks from a brief
          </DialogTitle>
          <DialogDescription>
            Paste a client brief, meeting notes or a feature request. You&apos;ll review every task
            before anything is added to {project.name}.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {!answer ? (
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor="plan-brief">Brief</Label>
                <button
                  type="button"
                  onClick={() => setBrief(EXAMPLE)}
                  className="text-accent-text text-xs underline-offset-2 hover:underline"
                >
                  Use an example
                </button>
              </div>
              <Textarea
                id="plan-brief"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={10}
                maxLength={6000}
                placeholder="What needs to happen? Requirements, bullet points and “nice to haves” all work."
                className="min-h-56"
              />
              {error && <p className="text-danger text-sm">{error}</p>}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {rows.length} suggested {rows.length === 1 ? "task" : "tasks"}
                </span>
                {answer.mode === "demo" ? (
                  <Tooltip content="Drafted by Taskora's built-in rules from your brief. Add an OpenAI key for live AI.">
                    <Badge tone="accent" className="cursor-help">
                      Demo AI
                    </Badge>
                  </Tooltip>
                ) : (
                  <Badge tone="accent">AI</Badge>
                )}
                <span className="text-subtle ml-auto text-xs">
                  {answer.creditsLeft} credits left
                </span>
              </div>
              <ul className="border-border divide-border-subtle rounded-card divide-y border">
                {rows.map((r) => (
                  <li
                    key={r.key}
                    className={cn(
                      "flex flex-wrap items-center gap-2 px-3 py-2",
                      !r.on && "opacity-55",
                    )}
                  >
                    <Checkbox
                      checked={r.on}
                      onCheckedChange={(v) => set(r.key, { on: v === true })}
                      aria-label={`Include ${r.title || "task"}`}
                    />
                    <input
                      value={r.title}
                      onChange={(e) => set(r.key, { title: e.target.value })}
                      aria-label="Task title"
                      maxLength={300}
                      className="hover:bg-surface-2 focus:bg-card focus:border-accent rounded-control min-w-0 flex-1 basis-56 border border-transparent bg-transparent px-2 py-1 text-sm outline-none"
                    />
                    <div className="flex items-center gap-1.5">
                      {r.labelIds.map((id) => {
                        const l = labels.find((x) => x.id === id);
                        return l ? (
                          <Badge key={id} tone={l.tone as BadgeTone} shape="tag">
                            {l.name}
                          </Badge>
                        ) : null;
                      })}
                      <Select
                        aria-label="Priority"
                        value={r.priority}
                        onValueChange={(v) =>
                          set(r.key, { priority: v as PlannedTask["priority"] })
                        }
                        className="h-8 w-[6.5rem] px-2 text-xs"
                        options={PRIORITIES.map((p) => ({
                          value: p,
                          label: (
                            <span className="flex items-center gap-1.5">
                              <PriorityIcon priority={p} /> {PRIORITY_META[p].label}
                            </span>
                          ),
                        }))}
                      />
                      <Select
                        aria-label="Estimate"
                        value={String(r.estimate)}
                        onValueChange={(v) => set(r.key, { estimate: Number(v) })}
                        className="h-8 w-[4.5rem] px-2 text-xs"
                        options={POINTS.map((n) => ({ value: String(n), label: `${n} pt` }))}
                      />
                      <button
                        type="button"
                        onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                        className="text-subtle hover:text-danger rounded p-1"
                        aria-label={`Remove ${r.title || "task"}`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Add to column</Label>
                  <Select
                    aria-label="Column"
                    value={statusId}
                    onValueChange={setStatusId}
                    options={statuses.map((s) => ({ value: s.id, label: s.name }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Sprint</Label>
                  <Select
                    aria-label="Sprint"
                    value={sprintId}
                    onValueChange={setSprintId}
                    options={[
                      { value: "none", label: "No sprint" },
                      ...sprints
                        .filter((s) => s.state !== "completed")
                        .map((s) => ({
                          value: s.id,
                          label: `${s.name}${s.id === activeSprint?.id ? " (active)" : ""}`,
                        })),
                    ]}
                  />
                </div>
              </div>
            </>
          )}
        </DialogBody>

        <DialogFooter>
          {answer ? (
            <>
              <Button variant="ghost" onClick={reset} className="sm:mr-auto">
                Edit brief
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={add} loading={adding} disabled={!chosen.length}>
                Add {chosen.length} {chosen.length === 1 ? "task" : "tasks"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                variant="ai"
                onClick={generate}
                disabled={running || brief.trim().length < 20}
              >
                {running ? <Loader2 className="animate-spin" /> : <Sparkles />}
                Draft tasks
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
