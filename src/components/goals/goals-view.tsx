"use client";

import { format, parseISO } from "date-fns";
import { Goal as GoalIcon, MoreHorizontal, Plus, Target, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/avatar";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { Card, EmptyState, Progress } from "@/components/ui/surface";
import {
  createGoal,
  deleteGoal,
  setGoalHealth,
  updateKeyResult,
} from "@/lib/project/manage-actions";
import { cn } from "@/lib/utils";

type Health = "on_track" | "at_risk" | "off_track";
type Person = { id: string; name: string; avatarUrl: string | null };
export type Goal = {
  id: string;
  title: string;
  description: string;
  period: string;
  dueDate: string | null;
  health: Health;
  owner: Person | null;
  keyResults: {
    id: string;
    title: string;
    start: number;
    current: number;
    target: number;
    unit: string;
  }[];
  projects: { key: string; name: string; color: string }[];
};

const HEALTH: Record<
  Health,
  { label: string; text: string; tone: "success" | "warning" | "danger" }
> = {
  on_track: { label: "On track", text: "text-success-text", tone: "success" },
  at_risk: { label: "At risk", text: "text-warning-text", tone: "warning" },
  off_track: { label: "Off track", text: "text-danger-text", tone: "danger" },
};

const krProgress = (k: Goal["keyResults"][number]) =>
  Math.max(0, Math.min(1, (k.current - k.start) / (k.target - k.start)));
const goalProgress = (g: Goal) =>
  g.keyResults.length
    ? g.keyResults.reduce((n, k) => n + krProgress(k), 0) / g.keyResults.length
    : 0;
const fmt = (n: number, unit: string) =>
  `${Number.isInteger(n) ? n : n.toFixed(1)}${unit === "%" || unit === "h" ? unit : unit ? ` ${unit}` : ""}`;

function KeyResult({
  kr,
  path,
  canEdit,
  tone,
}: {
  kr: Goal["keyResults"][number];
  path: string;
  canEdit: boolean;
  tone: "success" | "warning" | "danger";
}) {
  const [value, setValue] = useState(String(kr.current));
  const [prev, setPrev] = useState(kr.current);
  const [pending, start] = useTransition();
  if (prev !== kr.current) {
    setPrev(kr.current);
    setValue(String(kr.current));
  }
  const commit = () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n === kr.current) return setValue(String(kr.current));
    start(async () => {
      const res = await updateKeyResult({ path, id: kr.id, current: n });
      if (!res.ok) {
        toast.error(res.error);
        setValue(String(kr.current));
      }
    });
  };
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-2.5">
      <span className="text-fg-2 truncate text-sm">{kr.title}</span>
      <span className="text-muted flex items-center gap-1 text-xs tabular-nums">
        {canEdit ? (
          <input
            value={value}
            inputMode="decimal"
            aria-label={`Current value for ${kr.title}`}
            disabled={pending}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="hover:border-border focus:border-accent text-fg w-14 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-right font-medium outline-none"
          />
        ) : (
          <span className="text-fg font-medium">{fmt(kr.current, "")}</span>
        )}
        <span>/ {fmt(kr.target, kr.unit)}</span>
      </span>
      <Progress
        value={krProgress(kr) * 100}
        tone={tone}
        className="col-span-2 h-1.5"
        label={`${kr.title}: ${Math.round(krProgress(kr) * 100)}%`}
      />
    </li>
  );
}

function GoalCard({ goal, slug, canEdit }: { goal: Goal; slug: string; canEdit: boolean }) {
  const path = `/w/${slug}/goals`;
  const [pending, start] = useTransition();
  const pct = Math.round(goalProgress(goal) * 100);
  const h = HEALTH[goal.health];
  return (
    <Card className="p-5" aria-busy={pending}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-subtle flex flex-wrap items-center gap-x-2 text-xs">
            {goal.period && <span>{goal.period}</span>}
            {goal.dueDate && <span>· Due {format(parseISO(goal.dueDate), "MMM d")}</span>}
          </div>
          <h2 className="mt-1 text-base font-semibold tracking-tight">{goal.title}</h2>
          {goal.description && (
            <p className="text-muted mt-1 text-[13px] leading-relaxed">{goal.description}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums">{pct}%</div>
          <div className={cn("text-xs font-medium", h.text)}>{h.label}</div>
        </div>
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Manage ${goal.title}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              {(Object.keys(HEALTH) as Health[]).map((k) => (
                <DropdownMenuItem
                  key={k}
                  disabled={k === goal.health}
                  onSelect={() =>
                    start(async () => {
                      const res = await setGoalHealth({ path, id: goal.id, health: k });
                      if (!res.ok) toast.error(res.error);
                    })
                  }
                >
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      k === "on_track"
                        ? "bg-success"
                        : k === "at_risk"
                          ? "bg-warning"
                          : "bg-danger",
                    )}
                    aria-hidden
                  />
                  {HEALTH[k].label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                onSelect={() =>
                  start(async () => {
                    const res = await deleteGoal({ path, id: goal.id });
                    if (!res.ok) toast.error(res.error);
                    else toast.success("Goal deleted");
                  })
                }
              >
                <Trash2 /> Delete goal
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {goal.keyResults.length > 0 && (
        <ul className="divide-border-subtle mt-3 divide-y">
          {goal.keyResults.map((k) => (
            <KeyResult key={k.id} kr={k} path={path} canEdit={canEdit} tone={h.tone} />
          ))}
        </ul>
      )}

      <div className="border-border mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        {goal.owner && (
          <span className="text-muted flex items-center gap-1.5 text-xs">
            <Avatar
              name={goal.owner.name}
              src={goal.owner.avatarUrl}
              seed={goal.owner.id}
              size={20}
            />
            {goal.owner.name}
          </span>
        )}
        <span className="ml-auto flex flex-wrap gap-1.5">
          {goal.projects.map((p) => (
            <Link
              key={p.key}
              href={`/w/${slug}/p/${p.key}`}
              className="bg-elevated hover:text-fg text-muted flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs"
            >
              <span className="size-2 rounded-[2px]" style={{ background: p.color }} aria-hidden />
              {p.name}
            </Link>
          ))}
        </span>
      </div>
    </Card>
  );
}

type KrDraft = { title: string; start: string; target: string; unit: string };

function NewGoalDialog({
  open,
  onOpenChange,
  people,
  slug,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  people: Person[];
  slug: string;
  workspaceId: string;
}) {
  const [krs, setKrs] = useState<KrDraft[]>([{ title: "", start: "0", target: "100", unit: "" }]);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const quarter = `Q${Math.floor(new Date().getMonth() / 3) + 1} ${new Date().getFullYear()}`;
  const submit = (form: FormData) =>
    start(async () => {
      const res = await createGoal({
        path: `/w/${slug}/goals`,
        workspaceId,
        title: String(form.get("title")),
        description: String(form.get("description")),
        period: String(form.get("period")),
        dueDate: String(form.get("due")) || null,
        ownerId: String(form.get("owner")) || null,
        keyResults: krs
          .filter((k) => k.title.trim())
          .map((k) => ({
            title: k.title,
            start: Number(k.start),
            target: Number(k.target),
            unit: k.unit,
          })),
      });
      if (!res.ok) return setError(res.error);
      toast.success("Goal created");
      onOpenChange(false);
      setKrs([{ title: "", start: "0", target: "100", unit: "" }]);
      setError(undefined);
    });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form action={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>New goal</DialogTitle>
            <DialogDescription>
              Set an outcome and the numbers that prove you reached it.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="goal-title">Goal</Label>
              <Input
                id="goal-title"
                name="title"
                placeholder="e.g. Launch the new onboarding"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-desc">Why it matters</Label>
              <Textarea id="goal-desc" name="description" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="goal-period">Period</Label>
                <Input id="goal-period" name="period" defaultValue={quarter} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal-due">Due</Label>
                <Input id="goal-due" name="due" type="date" className="[color-scheme:light_dark]" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="goal-owner">Owner</Label>
                <select
                  id="goal-owner"
                  name="owner"
                  className="border-border bg-card rounded-control h-10 w-full border px-2.5 text-sm"
                >
                  <option value="">No owner</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-fg-2 mb-1 text-[13px] font-medium">Key results</legend>
              {krs.map((k, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_3.5rem_auto] items-center gap-2"
                >
                  <Input
                    value={k.title}
                    onChange={(e) =>
                      setKrs((l) =>
                        l.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                      )
                    }
                    placeholder="Metric"
                    aria-label="Key result"
                    className="h-9"
                  />
                  <Input
                    value={k.start}
                    inputMode="decimal"
                    onChange={(e) =>
                      setKrs((l) =>
                        l.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)),
                      )
                    }
                    aria-label="Start value"
                    className="h-9"
                  />
                  <Input
                    value={k.target}
                    inputMode="decimal"
                    onChange={(e) =>
                      setKrs((l) =>
                        l.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)),
                      )
                    }
                    aria-label="Target value"
                    className="h-9"
                  />
                  <Input
                    value={k.unit}
                    onChange={(e) =>
                      setKrs((l) => l.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))
                    }
                    placeholder="unit"
                    aria-label="Unit"
                    className="h-9"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove key result"
                    onClick={() => setKrs((l) => l.filter((_, j) => j !== i))}
                  >
                    <X />
                  </Button>
                </div>
              ))}
              <p className="text-subtle text-xs">Metric · start · target · unit (e.g. %, h)</p>
              {krs.length < 6 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setKrs((l) => [...l, { title: "", start: "0", target: "100", unit: "" }])
                  }
                >
                  <Plus /> Add key result
                </Button>
              )}
            </fieldset>
            <FieldError>{error}</FieldError>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Create goal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function GoalsView({
  goals,
  people,
  slug,
  workspaceId,
  canEdit,
}: {
  goals: Goal[];
  people: Person[];
  slug: string;
  workspaceId: string;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const atRisk = goals.filter((g) => g.health !== "on_track").length;
  return (
    <>
      <PageHeader
        title="Goals"
        description={
          goals.length
            ? `${goals.length} goals · ${atRisk ? `${atRisk} need attention` : "all on track"}`
            : "Company outcomes, measured."
        }
        actions={
          canEdit && (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus /> New goal
            </Button>
          )
        }
      />
      <div className="mx-auto max-w-5xl px-4 py-6 pb-12 sm:px-8">
        {goals.length === 0 ? (
          <Card>
            <EmptyState
              icon={<GoalIcon />}
              title="No goals yet"
              description="Goals connect day-to-day tasks to the outcomes your team cares about."
            />
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {goals.map((g) => (
              <GoalCard key={g.id} goal={g} slug={slug} canEdit={canEdit} />
            ))}
          </div>
        )}
        <p className="text-subtle mt-6 flex items-center gap-1.5 text-xs">
          <Target className="size-3.5" aria-hidden /> Progress is the average of each goal&apos;s
          key results. Click a number to update it.
        </p>
      </div>
      <NewGoalDialog
        open={open}
        onOpenChange={setOpen}
        people={people}
        slug={slug}
        workspaceId={workspaceId}
      />
    </>
  );
}
