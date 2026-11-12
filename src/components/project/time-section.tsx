"use client";

import { format, parseISO } from "date-fns";
import { Pause, Play, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/shell/workspace-provider";
import { clock, formatDuration } from "@/components/time/format";
import { useElapsed } from "@/components/time/use-elapsed";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FieldError, Input } from "@/components/ui/input";
import type { TaskDetail } from "@/lib/project/types";
import { deleteTimeEntry, logTime, startTimer, stopTimer } from "@/lib/time-actions";
import { useProject } from "./store";

export function TimeSection({ task, reload }: { task: TaskDetail; reload: () => void }) {
  const { viewer } = useWorkspace();
  const { canEdit, basePath } = useProject();
  const [pending, start] = useTransition();
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState<string>();
  const mine = task.time.find((e) => !e.endedAt && e.user?.id === viewer.id);
  const elapsed = useElapsed(mine?.startedAt ?? null);
  // Finished entries plus my running timer (other people's running timers count once they stop).
  const total = task.time.reduce((n, e) => n + (e.durationSeconds ?? 0), 0) + (mine ? elapsed : 0);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Something went wrong.");
      reload();
    });

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-subtle text-xs font-medium tracking-wide uppercase">Time</h3>
        <span className="text-muted text-xs tabular-nums">{formatDuration(total)} logged</span>
        {canEdit && (
          <div className="ml-auto flex gap-1.5">
            {mine ? (
              <Button
                size="sm"
                variant="secondary"
                loading={pending}
                onClick={() => run(() => stopTimer({ path: basePath }))}
              >
                <Pause /> <span className="font-mono tabular-nums">{clock(elapsed)}</span>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                loading={pending}
                onClick={() => run(() => startTimer({ taskId: task.id, path: basePath }))}
              >
                <Play /> Start timer
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setLogging((v) => !v)}
              aria-expanded={logging}
            >
              <Plus /> Log time
            </Button>
          </div>
        )}
      </div>

      {logging && (
        <form
          className="border-border bg-surface rounded-card mb-2 grid gap-2 border p-3 sm:grid-cols-[5rem_5rem_9rem_minmax(0,1fr)_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            start(async () => {
              const minutes = Number(form.get("h") || 0) * 60 + Number(form.get("m") || 0);
              const res = await logTime({
                taskId: task.id,
                minutes,
                date: String(form.get("date")),
                note: String(form.get("note") ?? ""),
              });
              if (!res.ok) return setError(res.error);
              setError(undefined);
              setLogging(false);
              toast.success(`Logged ${formatDuration(minutes * 60)}`);
              reload();
            });
          }}
        >
          <Input
            name="h"
            type="number"
            min={0}
            max={24}
            placeholder="Hours"
            aria-label="Hours"
            className="h-9"
          />
          <Input
            name="m"
            type="number"
            min={0}
            max={59}
            placeholder="Min"
            aria-label="Minutes"
            className="h-9"
          />
          <Input
            name="date"
            type="date"
            defaultValue={format(new Date(), "yyyy-MM-dd")}
            aria-label="Date"
            className="h-9 [color-scheme:light_dark]"
          />
          <Input
            name="note"
            placeholder="What did you work on?"
            aria-label="Note"
            className="h-9"
          />
          <Button type="submit" size="sm" className="h-9" loading={pending}>
            Save
          </Button>
          {error && (
            <div className="sm:col-span-5">
              <FieldError>{error}</FieldError>
            </div>
          )}
        </form>
      )}

      {task.time.length > 0 && (
        <ul className="space-y-0.5">
          {task.time.slice(0, 8).map((e) => (
            <li
              key={e.id}
              className="group hover:bg-surface rounded-control flex items-center gap-2.5 px-2 py-1.5 text-[13px]"
            >
              <Avatar
                name={e.user?.name ?? "Former member"}
                src={e.user?.avatarUrl}
                seed={e.user?.id}
                size={20}
              />
              <span className="text-muted w-20 shrink-0 text-xs">
                {format(parseISO(e.startedAt), "EEE, MMM d")}
              </span>
              <span className="text-fg-2 min-w-0 flex-1 truncate">
                {e.note || (e.endedAt ? "Timer" : "Running…")}
              </span>
              <span className="tabular-nums">
                {e.endedAt ? (
                  formatDuration(e.durationSeconds ?? 0)
                ) : (
                  <span className="text-accent-text">running</span>
                )}
              </span>
              {e.user?.id === viewer.id && e.endedAt && (
                <button
                  type="button"
                  onClick={() => run(() => deleteTimeEntry({ id: e.id }))}
                  className="text-subtle hover:text-danger-text rounded p-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label="Delete time entry"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
