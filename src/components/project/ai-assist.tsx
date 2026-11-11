"use client";

import { FileText, ListTree, Loader2, Sparkles, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/controls";
import { Tooltip } from "@/components/ui/menu";
import { askAi, type AiAnswer, type AiKind } from "@/lib/ai/actions";
import { cn } from "@/lib/utils";
import { useProject } from "./store";

const ACTIONS: {
  kind: AiKind;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { kind: "breakdown", label: "Break into subtasks", icon: ListTree },
  { kind: "summary", label: "Summarize", icon: Sparkles },
  { kind: "description", label: "Draft description", icon: FileText },
];

export function AiAssist({
  taskId,
  number,
  hasDescription,
  onUseDescription,
  onSubtasksAdded,
}: {
  taskId: string;
  number: number;
  hasDescription: boolean;
  onUseDescription: (text: string) => void;
  onSubtasksAdded: () => void;
}) {
  const { project, statuses, create, canEdit } = useProject();
  const [answer, setAnswer] = useState<AiAnswer | null>(null);
  const [running, setRunning] = useState<AiKind | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [adding, startAdding] = useTransition();

  if (!canEdit) return null;

  const run = async (kind: AiKind) => {
    setRunning(kind);
    const res = await askAi({ kind, projectId: project.id, number });
    setRunning(null);
    if (!res.ok) return void toast.error(res.error);
    setAnswer(res.data);
    if (res.data.kind === "breakdown") setPicked(new Set(res.data.subtasks.map((_, i) => i)));
  };

  const addSubtasks = () =>
    startAdding(async () => {
      if (answer?.kind !== "breakdown") return;
      const todo = statuses.find((s) => s.category === "unstarted") ?? statuses[0];
      const chosen = answer.subtasks.filter((_, i) => picked.has(i));
      for (const s of chosen)
        await create(s.title, { parentId: taskId, statusId: todo?.id, estimate: s.estimate });
      toast.success(`Added ${chosen.length} subtasks`);
      setAnswer(null);
      onSubtasksAdded();
    });

  return (
    <section className="mt-6" aria-label="AI assistant">
      <div className="flex flex-wrap gap-1.5">
        {ACTIONS.map((a) => (
          <Button
            key={a.kind}
            type="button"
            variant="ai"
            size="sm"
            disabled={running !== null}
            onClick={() => run(a.kind)}
          >
            {running === a.kind ? <Loader2 className="animate-spin" /> : <a.icon />}
            {a.kind === "description" && hasDescription ? "Rewrite description" : a.label}
          </Button>
        ))}
      </div>

      {answer && (
        <div
          className="border-accent-border bg-accent-soft/40 rounded-card mt-3 border p-3.5"
          aria-live="polite"
        >
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="text-accent-text size-3.5" aria-hidden />
            <span className="text-[13px] font-medium">
              {answer.kind === "breakdown"
                ? "Suggested subtasks"
                : answer.kind === "summary"
                  ? "Summary"
                  : "Suggested description"}
            </span>
            {answer.mode === "demo" ? (
              <Tooltip content="This is a pre-written demo answer built from the task. Add an OpenAI key to get live AI.">
                <Badge tone="accent" className="cursor-help">
                  Demo AI
                </Badge>
              </Tooltip>
            ) : (
              <Badge tone="accent">AI</Badge>
            )}
            <span className="text-subtle ml-auto text-[11px]">
              {answer.creditsLeft} credits left
            </span>
            <button
              type="button"
              onClick={() => setAnswer(null)}
              className="text-subtle hover:text-fg rounded p-0.5"
              aria-label="Dismiss"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {answer.kind === "summary" && (
            <ul className="text-fg-2 space-y-1 text-sm leading-relaxed">
              {answer.lines.map((l, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-accent-text" aria-hidden>
                    •
                  </span>
                  {l}
                </li>
              ))}
            </ul>
          )}

          {answer.kind === "description" && (
            <>
              <p className="text-fg-2 bg-card rounded-control border-border border p-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                {answer.description}
              </p>
              <div className="mt-2.5 flex justify-end gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setAnswer(null)}>
                  Discard
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onUseDescription(answer.description);
                    setAnswer(null);
                  }}
                >
                  Use this description
                </Button>
              </div>
            </>
          )}

          {answer.kind === "breakdown" &&
            (answer.subtasks.length === 0 ? (
              <p className="text-muted text-sm">
                This task already covers the steps I&apos;d suggest.
              </p>
            ) : (
              <>
                <ul className="space-y-0.5">
                  {answer.subtasks.map((s, i) => (
                    <li key={i}>
                      <label
                        className={cn(
                          "hover:bg-card rounded-control flex cursor-pointer items-center gap-2.5 px-1.5 py-1.5 text-sm",
                          !picked.has(i) && "text-muted",
                        )}
                      >
                        <Checkbox
                          checked={picked.has(i)}
                          onCheckedChange={(v) =>
                            setPicked((set) => {
                              const n = new Set(set);
                              if (v) n.add(i);
                              else n.delete(i);
                              return n;
                            })
                          }
                        />
                        <span className="flex-1">{s.title}</span>
                        <span className="text-subtle text-xs tabular-nums">{s.estimate} pt</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="mt-2.5 flex justify-end">
                  <Button
                    size="sm"
                    onClick={addSubtasks}
                    loading={adding}
                    disabled={picked.size === 0}
                  >
                    Add {picked.size} {picked.size === 1 ? "subtask" : "subtasks"}
                  </Button>
                </div>
              </>
            ))}
        </div>
      )}
    </section>
  );
}
