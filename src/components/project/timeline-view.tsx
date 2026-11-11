"use client";

import {
  addDays,
  differenceInCalendarDays,
  format,
  isWeekend,
  parseISO,
  startOfWeek,
} from "date-fns";
import { GanttChart } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/ui/surface";
import type { BoardTask } from "@/lib/project/types";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "./pickers";
import { isDoneCategory, useProject } from "./store";

const ZOOM = { week: 40, month: 16 } as const;
type Zoom = keyof typeof ZOOM;

const span = (t: BoardTask) => {
  const start = parseISO(t.startDate ?? t.dueDate!);
  const end = parseISO(t.dueDate ?? t.startDate!);
  return { start, end };
};

export function TimelineView() {
  const { tasks, statusById, sprints, openTask } = useProject();
  const [zoom, setZoom] = useState<Zoom>("week");
  const scroller = useRef<HTMLDivElement>(null);
  const dayW = ZOOM[zoom];

  const scheduled = useMemo(
    () =>
      tasks
        .filter((t) => t.startDate || t.dueDate)
        .sort((a, b) => span(a).start.getTime() - span(b).start.getTime()),
    [tasks],
  );
  const unscheduled = tasks.length - scheduled.length;

  const { origin, days } = useMemo(() => {
    const today = new Date();
    let min = addDays(today, -14);
    let max = addDays(today, 42);
    for (const t of scheduled) {
      const s = span(t);
      if (s.start < min) min = s.start;
      if (s.end > max) max = s.end;
    }
    const origin = startOfWeek(addDays(min, -3), { weekStartsOn: 1 });
    return { origin, days: differenceInCalendarDays(max, origin) + 10 };
  }, [scheduled]);

  const x = (d: Date) => differenceInCalendarDays(d, origin) * dayW;
  const todayX = x(new Date());

  useEffect(() => {
    scroller.current?.scrollTo({ left: Math.max(0, todayX - 160) });
  }, [todayX]);

  if (scheduled.length === 0) {
    return (
      <EmptyState
        icon={<GanttChart />}
        title="Nothing scheduled yet"
        description="Give tasks a start or due date and they'll appear on the timeline."
      />
    );
  }

  const dates = Array.from({ length: days }, (_, i) => addDays(origin, i));
  const weeks = dates.filter((d) => d.getDay() === 1);
  const width = days * dayW;
  const ROW = 40;

  return (
    <div className="pb-10">
      <div className="flex items-center gap-2 px-4 py-3 sm:px-8">
        <div
          className="border-border bg-card rounded-control flex border p-0.5"
          role="group"
          aria-label="Zoom"
        >
          {(Object.keys(ZOOM) as Zoom[]).map((z) => (
            <button
              key={z}
              type="button"
              aria-pressed={zoom === z}
              onClick={() => setZoom(z)}
              className={cn(
                "text-muted rounded-md px-2.5 py-1 text-xs font-medium capitalize",
                zoom === z && "bg-elevated text-fg",
              )}
            >
              {z}s
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            scroller.current?.scrollTo({ left: Math.max(0, todayX - 160), behavior: "smooth" })
          }
          className="border-border bg-card hover:bg-elevated rounded-control border px-2.5 py-1 text-xs font-medium"
        >
          Today
        </button>
        {unscheduled > 0 && (
          <span className="text-subtle ml-auto text-xs">{unscheduled} tasks have no dates</span>
        )}
      </div>

      <div className="border-border rounded-card mx-4 flex overflow-hidden border sm:mx-8">
        {/* Task names */}
        <div className="border-border bg-surface w-40 shrink-0 border-r sm:w-64">
          <div className="border-border text-subtle flex h-14 items-end border-b px-3 pb-2 text-xs font-medium">
            Task
          </div>
          {scheduled.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => openTask(t.ref)}
              className="border-border-subtle hover:bg-elevated flex w-full items-center gap-2 border-b px-3 text-left text-[13px]"
              style={{ height: ROW }}
            >
              <span className="text-subtle hidden font-mono text-[10px] sm:inline">{t.ref}</span>
              <span className="min-w-0 flex-1 truncate">{t.title}</span>
            </button>
          ))}
        </div>

        {/* Chart */}
        <div ref={scroller} className="min-w-0 flex-1 overflow-x-auto">
          <div className="relative" style={{ width }}>
            <div className="border-border relative h-14 border-b">
              {sprints.map((s) => {
                const left = x(parseISO(s.startDate));
                const w =
                  (differenceInCalendarDays(parseISO(s.endDate), parseISO(s.startDate)) + 1) * dayW;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "absolute top-1.5 flex h-5 items-center truncate rounded px-2 text-[10.5px] font-medium",
                      s.state === "active"
                        ? "bg-accent-soft text-accent-text"
                        : "bg-elevated text-muted",
                    )}
                    style={{ left, width: w }}
                  >
                    {s.name}
                  </div>
                );
              })}
              {weeks.map((w) => (
                <div
                  key={w.toISOString()}
                  className="text-subtle absolute bottom-2 text-[11px] whitespace-nowrap"
                  style={{ left: x(w) + 4 }}
                >
                  {format(w, zoom === "week" ? "MMM d" : "MMM d")}
                </div>
              ))}
            </div>

            <div className="relative" style={{ height: scheduled.length * ROW }}>
              {dates.map((d) =>
                isWeekend(d) ? (
                  <div
                    key={d.toISOString()}
                    className="bg-surface/60 absolute inset-y-0"
                    style={{ left: x(d), width: dayW }}
                  />
                ) : null,
              )}
              {weeks.map((w) => (
                <div
                  key={w.toISOString()}
                  className="bg-border-subtle absolute inset-y-0 w-px"
                  style={{ left: x(w) }}
                />
              ))}
              <div
                className="bg-accent absolute inset-y-0 z-10 w-0.5"
                style={{ left: todayX + dayW / 2 }}
                aria-hidden
              />

              {scheduled.map((t, i) => {
                const s = span(t);
                const status = statusById.get(t.statusId);
                const done = isDoneCategory(status?.category ?? "");
                const left = x(s.start);
                const w = Math.max(dayW, (differenceInCalendarDays(s.end, s.start) + 1) * dayW);
                const overdue = !done && t.dueDate && parseISO(t.dueDate) < addDays(new Date(), -1);
                return (
                  <div
                    key={t.id}
                    className="border-border-subtle absolute inset-x-0 border-b"
                    style={{ top: i * ROW, height: ROW }}
                  >
                    <button
                      type="button"
                      onClick={() => openTask(t.ref)}
                      title={`${t.ref} · ${t.title} (${format(s.start, "MMM d")} – ${format(s.end, "MMM d")})`}
                      className={cn(
                        "absolute top-2 flex h-6 items-center gap-1.5 overflow-hidden rounded-md px-1.5 text-[11.5px] font-medium text-[#0E0F11] hover:brightness-110",
                        done && "opacity-50",
                        overdue && "ring-danger ring-2",
                      )}
                      style={{ left, width: w, background: status?.color ?? "var(--accent)" }}
                    >
                      <PersonAvatar id={t.assigneeId} size={16} />
                      {w > 90 && <span className="truncate">{t.title}</span>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
