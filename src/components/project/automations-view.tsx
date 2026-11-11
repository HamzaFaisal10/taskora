"use client";

import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { ArrowRight, Plus, Trash2, Workflow, X, Zap } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Card, EmptyState } from "@/components/ui/surface";
import {
  createAutomation,
  deleteAutomation,
  setAutomationEnabled,
  type AutomationInput,
} from "@/lib/project/manage-actions";
import { cn } from "@/lib/utils";
import { useProject } from "./store";

export type Automation = {
  id: string;
  name: string;
  trigger: AutomationInput["trigger"];
  conditions: AutomationInput["conditions"];
  actions: AutomationInput["actions"];
  enabled: boolean;
  runCount: number;
  lastRunAt: string | null;
};

type Trigger = AutomationInput["trigger"];
type Action = AutomationInput["actions"][number];

const CATEGORY_LABEL: Record<string, string> = {
  triage: "Triage",
  backlog: "Backlog",
  unstarted: "To do",
  started: "In progress",
  review: "In review",
  completed: "Done",
  canceled: "Canceled",
};
const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "No priority",
};

function useDescribe() {
  const { people, labels, statuses } = useProject();
  const person = (id: string) => people.find((p) => p.id === id)?.name ?? "a former member";
  const label = (id: string) => labels.find((l) => l.id === id)?.name ?? "a deleted label";
  const category = (c: string) =>
    statuses.find((s) => s.category === c)?.name ?? CATEGORY_LABEL[c] ?? c;

  const trigger = (t: Trigger, conditions: AutomationInput["conditions"]) => {
    const labelCond = conditions.find((c) => c.field === "label_id");
    switch (t.type) {
      case "task_created":
        return conditions.some((c) => c.field === "source" && c.value === "form")
          ? "a form creates a task"
          : "a task is created";
      case "status_changed":
        return `a task moves to ${category(t.to_category)}`;
      case "label_added":
        return labelCond
          ? `the ${label(String(labelCond.value))} label is added`
          : "a label is added";
      case "due_in":
        return t.days === 0
          ? "a task is due today"
          : `a task is due in ${t.days} ${t.days === 1 ? "day" : "days"}`;
    }
  };
  const action = (a: Action) => {
    switch (a.type) {
      case "assign":
        return `assign to ${person(a.user_id)}`;
      case "notify":
        return `notify ${person(a.user_id)}`;
      case "notify_assignee":
        return "notify the assignee";
      case "set_priority":
        return `set priority to ${PRIORITY_LABEL[a.priority]}`;
      case "move_to_category":
        return `move to ${category(a.category)}`;
      case "add_label":
        return `add the ${label(a.label_id)} label`;
      case "complete_subtasks":
        return "complete its subtasks";
      case "stop_timers":
        return "stop running timers";
    }
  };
  return { trigger, action };
}

function RuleCard({ rule }: { rule: Automation }) {
  const { basePath, canEdit } = useProject();
  const describe = useDescribe();
  const [enabled, setEnabled] = useState(rule.enabled);
  const [pending, start] = useTransition();
  const toggle = (v: boolean) => {
    setEnabled(v);
    start(async () => {
      const res = await setAutomationEnabled({ path: basePath, id: rule.id, enabled: v });
      if (!res.ok) {
        setEnabled(!v);
        toast.error(res.error);
      }
    });
  };
  const remove = () =>
    start(async () => {
      const res = await deleteAutomation({ path: basePath, id: rule.id });
      if (!res.ok) toast.error(res.error);
      else toast.success("Rule deleted");
    });
  return (
    <Card className={cn("p-4 transition-opacity", !enabled && "opacity-60")}>
      <div className="flex items-start gap-3">
        <span className="bg-accent-soft text-accent-text rounded-control flex size-8 shrink-0 items-center justify-center">
          <Zap className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{rule.name}</h3>
          <p className="text-fg-2 mt-1 text-[13px] leading-relaxed">
            <span className="text-subtle">When</span>{" "}
            {describe.trigger(rule.trigger, rule.conditions)}
            {rule.conditions.some((c) => c.field === "status_category" && c.op === "not_in") && (
              <span className="text-subtle"> and it isn&apos;t finished</span>
            )}
            <ArrowRight
              className="text-subtle mx-1.5 inline size-3.5 align-[-2px]"
              aria-label="then"
            />
            {rule.actions.map((a, i) => (
              <span key={i}>
                {i > 0 && (
                  <span className="text-subtle">
                    {i === rule.actions.length - 1 ? " and " : ", "}
                  </span>
                )}
                {describe.action(a)}
              </span>
            ))}
          </p>
          <p className="text-subtle mt-2 text-xs">
            Ran {rule.runCount} {rule.runCount === 1 ? "time" : "times"}
            {rule.lastRunAt &&
              ` · last ${formatDistanceToNowStrict(parseISO(rule.lastRunAt), { addSuffix: true })}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Switch
            checked={enabled}
            onCheckedChange={toggle}
            disabled={!canEdit || pending}
            aria-label={enabled ? `Turn off ${rule.name}` : `Turn on ${rule.name}`}
          />
          {canEdit && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${rule.name}`}
              onClick={remove}
              disabled={pending}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

const selectCls = "border-border bg-card rounded-control h-9 border px-2.5 text-sm";

function ActionEditor({
  value,
  onChange,
  onRemove,
}: {
  value: Action;
  onChange: (a: Action) => void;
  onRemove: () => void;
}) {
  const { people, labels, statuses } = useProject();
  const categories = [...new Set(statuses.map((s) => s.category))];
  const setType = (type: Action["type"]) => {
    const first = people[0]?.id ?? "";
    const next: Record<Action["type"], Action> = {
      assign: { type: "assign", user_id: first },
      notify: { type: "notify", user_id: first },
      notify_assignee: { type: "notify_assignee" },
      set_priority: { type: "set_priority", priority: "high" },
      move_to_category: { type: "move_to_category", category: "review" },
      add_label: { type: "add_label", label_id: labels[0]?.id ?? "" },
      complete_subtasks: { type: "complete_subtasks" },
      stop_timers: { type: "stop_timers" },
    };
    onChange(next[type]);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Action"
        value={value.type}
        onChange={(e) => setType(e.target.value as Action["type"])}
        className={selectCls}
      >
        <option value="assign">Assign to</option>
        <option value="notify">Notify</option>
        <option value="notify_assignee">Notify the assignee</option>
        <option value="set_priority">Set priority</option>
        <option value="move_to_category">Move to</option>
        {labels.length > 0 && <option value="add_label">Add label</option>}
        <option value="complete_subtasks">Complete subtasks</option>
        <option value="stop_timers">Stop timers</option>
      </select>
      {(value.type === "assign" || value.type === "notify") && (
        <select
          aria-label="Person"
          value={value.user_id}
          onChange={(e) => onChange({ ...value, user_id: e.target.value })}
          className={selectCls}
        >
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      {value.type === "set_priority" && (
        <select
          aria-label="Priority"
          value={value.priority}
          onChange={(e) =>
            onChange({ ...value, priority: e.target.value as typeof value.priority })
          }
          className={selectCls}
        >
          {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      )}
      {value.type === "move_to_category" && (
        <select
          aria-label="Status"
          value={value.category}
          onChange={(e) =>
            onChange({ ...value, category: e.target.value as typeof value.category })
          }
          className={selectCls}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {statuses.find((s) => s.category === c)?.name ?? CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      )}
      {value.type === "add_label" && (
        <select
          aria-label="Label"
          value={value.label_id}
          onChange={(e) => onChange({ ...value, label_id: e.target.value })}
          className={selectCls}
        >
          {labels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Remove action"
        onClick={onRemove}
      >
        <X />
      </Button>
    </div>
  );
}

function NewRuleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { project, basePath, statuses, labels } = useProject();
  const categories = [...new Set(statuses.map((s) => s.category))];
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<Trigger>({
    type: "status_changed",
    to_category: "review",
  });
  const [labelId, setLabelId] = useState(labels[0]?.id ?? "");
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [actions, setActions] = useState<Action[]>([{ type: "notify_assignee" }]);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const setTriggerType = (type: Trigger["type"]) =>
    setTrigger(
      type === "status_changed"
        ? { type, to_category: "review" }
        : type === "due_in"
          ? { type, days: 1 }
          : { type },
    );

  const save = () =>
    start(async () => {
      const conditions: AutomationInput["conditions"] = [];
      if (trigger.type === "label_added" && labelId)
        conditions.push({ field: "label_id", op: "eq", value: labelId });
      if (trigger.type === "due_in" && onlyOpen)
        conditions.push({
          field: "status_category",
          op: "not_in",
          value: ["completed", "canceled"],
        });
      const res = await createAutomation({
        path: basePath,
        projectId: project.id,
        name,
        trigger,
        conditions,
        actions,
      });
      if (!res.ok) return setError(res.error);
      toast.success("Rule created");
      onOpenChange(false);
      setName("");
      setActions([{ type: "notify_assignee" }]);
      setError(undefined);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>New automation</DialogTitle>
          <DialogDescription>
            Rules run instantly inside the database whenever a task changes.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="rule-name">Name</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Reviews go to the lead"
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-fg-2 mb-1.5 text-[13px] font-medium">When</legend>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Trigger"
                value={trigger.type}
                onChange={(e) => setTriggerType(e.target.value as Trigger["type"])}
                className={selectCls}
              >
                <option value="status_changed">A task moves to</option>
                <option value="task_created">A task is created</option>
                {labels.length > 0 && <option value="label_added">A label is added</option>}
                <option value="due_in">A task is due in</option>
              </select>
              {trigger.type === "status_changed" && (
                <select
                  aria-label="Status"
                  value={trigger.to_category}
                  onChange={(e) =>
                    setTrigger({
                      type: "status_changed",
                      to_category: e.target.value as typeof trigger.to_category,
                    })
                  }
                  className={selectCls}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {statuses.find((s) => s.category === c)?.name ?? CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </select>
              )}
              {trigger.type === "label_added" && (
                <select
                  aria-label="Label"
                  value={labelId}
                  onChange={(e) => setLabelId(e.target.value)}
                  className={selectCls}
                >
                  {labels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              )}
              {trigger.type === "due_in" && (
                <>
                  <select
                    aria-label="Days"
                    value={trigger.days}
                    onChange={(e) => setTrigger({ type: "due_in", days: Number(e.target.value) })}
                    className={selectCls}
                  >
                    {[0, 1, 2, 3, 7].map((d) => (
                      <option key={d} value={d}>
                        {d === 0 ? "0 days (today)" : `${d} ${d === 1 ? "day" : "days"}`}
                      </option>
                    ))}
                  </select>
                  <label className="text-muted flex items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      checked={onlyOpen}
                      onChange={(e) => setOnlyOpen(e.target.checked)}
                      className="accent-[var(--accent)]"
                    />
                    only if it isn&apos;t finished
                  </label>
                </>
              )}
            </div>
            {trigger.type === "due_in" && (
              <p className="text-subtle text-xs">Checked once a day, early in the morning.</p>
            )}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-fg-2 mb-1.5 text-[13px] font-medium">Then</legend>
            {actions.map((a, i) => (
              <ActionEditor
                key={i}
                value={a}
                onChange={(next) => setActions((list) => list.map((x, j) => (j === i ? next : x)))}
                onRemove={() => setActions((list) => list.filter((_, j) => j !== i))}
              />
            ))}
            {actions.length < 5 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setActions((l) => [...l, { type: "set_priority", priority: "high" }])
                }
              >
                <Plus /> Add action
              </Button>
            )}
          </fieldset>
          <FieldError>{error}</FieldError>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={pending}>
            Create rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AutomationsView({ rules }: { rules: Automation[] }) {
  const { canEdit } = useProject();
  const [open, setOpen] = useState(false);
  const active = rules.filter((r) => r.enabled).length;
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-12 sm:px-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-base font-semibold">Automations</h2>
          <p className="text-muted text-sm">
            {rules.length === 0
              ? "Let Taskora handle the busywork."
              : `${active} of ${rules.length} rules on`}
            {rules.length > 0 && (
              <Badge tone="neutral" className="ml-2">
                {rules.reduce((n, r) => n + r.runCount, 0)} runs
              </Badge>
            )}
          </p>
        </div>
        {canEdit && (
          <Button className="ml-auto" size="sm" onClick={() => setOpen(true)}>
            <Plus /> New rule
          </Button>
        )}
      </div>
      {rules.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Workflow />}
            title="No automations yet"
            description="For example: when a task moves to Review, assign it to your lead and notify them."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((r) => (
            <RuleCard key={r.id} rule={r} />
          ))}
        </div>
      )}
      <NewRuleDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
