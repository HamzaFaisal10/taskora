"use client";

import { Plus, Search, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { addDependency, removeDependency } from "@/lib/project/actions";
import type { TaskDetail } from "@/lib/project/types";
import { cn } from "@/lib/utils";
import { isDoneCategory, useProject } from "./store";

export function BlockersSection({ task, reload }: { task: TaskDetail; reload: () => void }) {
  const { allTasks, statusById, openTask, canEdit } = useProject();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  if (!canEdit && task.blockedBy.length === 0) return null;

  const taken = new Set([task.id, ...task.blockedBy.map((b) => b.id)]);
  const options = allTasks
    .filter((t) => !taken.has(t.id) && !isDoneCategory(statusById.get(t.statusId)?.category ?? ""))
    .filter((t) => !q || `${t.ref} ${t.title}`.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 8);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Something went wrong.");
      reload();
    });

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-subtle text-xs font-medium tracking-wide uppercase">Blocked by</h3>
        {canEdit && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-subtle hover:text-fg hover:bg-elevated ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
              >
                <Plus className="size-3.5" aria-hidden /> Add blocker
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-1.5">
              <div className="border-border flex items-center gap-2 border-b px-2 pb-1.5">
                <Search className="text-subtle size-3.5" aria-hidden />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Find a task"
                  aria-label="Find a task"
                  className="h-8 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
              <ul className="max-h-64 overflow-y-auto pt-1">
                {options.length === 0 && (
                  <li className="text-subtle px-2 py-2 text-xs">No open tasks match.</li>
                )}
                {options.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setOpen(false);
                        setQ("");
                        run(() => addDependency({ taskId: task.id, blockedById: o.id }));
                      }}
                      className="hover:bg-elevated flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
                    >
                      <span className="text-subtle font-mono text-[11px]">{o.ref}</span>
                      <span className="truncate">{o.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        )}
      </div>
      {task.blockedBy.length === 0 ? (
        <p className="text-subtle px-2 text-[13px]">Nothing is blocking this task.</p>
      ) : (
        <ul className="space-y-1">
          {task.blockedBy.map((b) => (
            <li
              key={b.id}
              className="group hover:bg-elevated rounded-control flex items-center gap-2 px-2 py-1.5 text-sm"
            >
              <button
                type="button"
                onClick={() => openTask(b.ref)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    b.done ? "bg-success" : "bg-danger",
                  )}
                  aria-hidden
                />
                <span className="sr-only">{b.done ? "Done:" : "Still open:"}</span>
                <span className="text-subtle font-mono text-[11px]">{b.ref}</span>
                <span className={cn("truncate", b.done && "text-muted line-through")}>
                  {b.title}
                </span>
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() =>
                    run(() => removeDependency({ taskId: task.id, blockedById: b.id }))
                  }
                  className="text-subtle hover:text-fg rounded p-0.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Remove ${b.ref} as a blocker`}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
