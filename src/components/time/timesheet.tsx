"use client";

import { addDays, format, isToday, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Clock, Download } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import { formatDuration } from "./format";

export type Entry = {
  id: string;
  startedAt: string;
  running: boolean;
  seconds: number;
  note: string;
  person: { id: string; name: string; avatarUrl: string | null };
  task: {
    ref: string;
    title: string;
    projectKey: string;
    projectName: string;
    projectColor: string;
  };
};

const hours = (s: number) => (s > 0 && s < 360 ? "<0.1" : (s / 3600).toFixed(1));

function downloadCsv(entries: Entry[], weekStart: string) {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [
    ["Date", "Person", "Project", "Task", "Title", "Hours", "Note"],
    ...entries.map((e) => [
      format(parseISO(e.startedAt), "yyyy-MM-dd"),
      e.person.name,
      e.task.projectName,
      e.task.ref,
      e.task.title,
      hours(e.seconds),
      e.note,
    ]),
  ];
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `timesheet-${weekStart}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function Timesheet({
  slug,
  weekStart,
  entries,
  viewerId,
}: {
  slug: string;
  weekStart: string;
  entries: Entry[];
  viewerId: string;
}) {
  const [scope, setScope] = useState<"everyone" | "me">("everyone");
  const start = parseISO(weekStart);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const visible = useMemo(
    () => entries.filter((e) => !e.running && (scope === "everyone" || e.person.id === viewerId)),
    [entries, scope, viewerId],
  );
  // Timers that are still running are listed on their own; they join the totals when stopped.
  const running = useMemo(
    () => entries.filter((e) => e.running && (scope === "everyone" || e.person.id === viewerId)),
    [entries, scope, viewerId],
  );

  const people = useMemo(() => {
    const map = new Map<string, { person: Entry["person"]; perDay: number[]; total: number }>();
    for (const e of visible) {
      const row = map.get(e.person.id) ?? { person: e.person, perDay: Array(7).fill(0), total: 0 };
      const d = Math.floor(
        (parseISO(e.startedAt).getTime() - parseISO(weekStart).getTime()) / 86_400_000,
      );
      if (d >= 0 && d < 7) row.perDay[d] += e.seconds;
      row.total += e.seconds;
      map.set(e.person.id, row);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [visible, weekStart]);

  const dayTotals = days.map((_, i) => people.reduce((n, p) => n + p.perDay[i], 0));
  const total = dayTotals.reduce((a, b) => a + b, 0);
  const prev = format(addDays(start, -7), "yyyy-MM-dd");
  const next = format(addDays(start, 7), "yyyy-MM-dd");
  const thisWeek = days.some((d) => isToday(d));

  return (
    <>
      <PageHeader
        title="Time"
        description={`${format(start, "MMM d")} – ${format(addDays(start, 6), "MMM d, yyyy")} · ${formatDuration(total)} logged`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="border-border bg-card rounded-control flex border p-0.5"
              role="group"
              aria-label="Whose time"
            >
              {(["everyone", "me"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={scope === s}
                  onClick={() => setScope(s)}
                  className={cn(
                    "text-muted rounded-md px-2.5 py-1 text-xs font-medium",
                    scope === s && "bg-elevated text-fg",
                  )}
                >
                  {s === "me" ? "Just me" : "Everyone"}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="icon-sm" asChild aria-label="Previous week">
              <Link href={`/w/${slug}/time?week=${prev}`}>
                <ChevronLeft />
              </Link>
            </Button>
            <Button variant="ghost" size="icon-sm" asChild aria-label="Next week">
              <Link href={`/w/${slug}/time?week=${next}`}>
                <ChevronRight />
              </Link>
            </Button>
            {!thisWeek && (
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/w/${slug}/time`}>This week</Link>
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              disabled={visible.length === 0}
              onClick={() => downloadCsv(visible, weekStart)}
            >
              <Download /> CSV
            </Button>
          </div>
        }
      />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-12 sm:px-8">
        {running.length > 0 && (
          <Card className="p-0">
            <h2 className="text-fg-2 border-border-subtle border-b px-4 py-2.5 text-[13px] font-medium">
              Running now
            </h2>
            <ul className="divide-border-subtle divide-y">
              {running.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span
                    className="bg-accent size-2 shrink-0 animate-pulse rounded-full"
                    aria-hidden
                  />
                  <Avatar
                    name={e.person.name}
                    src={e.person.avatarUrl}
                    seed={e.person.id}
                    size={22}
                  />
                  <span className="text-muted shrink-0">{e.person.name}</span>
                  <Link
                    href={`/w/${slug}/p/${e.task.projectKey}?task=${e.task.ref}`}
                    className="min-w-0 flex-1 truncate hover:underline"
                  >
                    <span className="text-subtle font-mono text-[11px]">{e.task.ref}</span>{" "}
                    {e.task.title}
                  </Link>
                  <span className="text-subtle shrink-0 text-xs">
                    since {format(parseISO(e.startedAt), "h:mm a")}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {visible.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Clock />}
              title="No time logged this week"
              description={
                running.length
                  ? "Running timers are added here when they're stopped."
                  : "Start a timer or log time from any task's panel."
              }
            />
          </Card>
        ) : (
          <>
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-subtle border-border border-b text-xs">
                    <th className="px-4 py-2.5 text-left font-medium">Person</th>
                    {days.map((d) => (
                      <th
                        key={d.toISOString()}
                        className={cn(
                          "py-2.5 text-right font-medium",
                          isToday(d) && "text-accent-text",
                        )}
                      >
                        {format(d, "EEE d")}
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.person.id} className="border-border-subtle border-b">
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2">
                          <Avatar
                            name={p.person.name}
                            src={p.person.avatarUrl}
                            seed={p.person.id}
                            size={22}
                          />
                          {p.person.name}
                        </span>
                      </td>
                      {p.perDay.map((s, i) => (
                        <td
                          key={i}
                          className={cn("py-2.5 text-right tabular-nums", s ? "" : "text-subtle")}
                        >
                          {s ? hours(s) : "–"}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                        {hours(p.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="text-muted text-xs">
                    <td className="px-4 py-2.5">Total hours</td>
                    {dayTotals.map((s, i) => (
                      <td key={i} className="py-2.5 text-right tabular-nums">
                        {s ? hours(s) : "–"}
                      </td>
                    ))}
                    <td className="text-fg px-4 py-2.5 text-right font-semibold tabular-nums">
                      {hours(total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </Card>

            <section aria-labelledby="entries">
              <h2 id="entries" className="mb-3 text-[13px] font-semibold">
                Entries
              </h2>
              <Card className="divide-border-subtle divide-y p-0">
                {[...visible].reverse().map((e) => (
                  <Link
                    key={e.id}
                    href={`/w/${slug}/p/${e.task.projectKey}?task=${e.task.ref}`}
                    className="hover:bg-surface flex items-center gap-3 px-4 py-2.5 text-sm"
                  >
                    <Avatar
                      name={e.person.name}
                      src={e.person.avatarUrl}
                      seed={e.person.id}
                      size={22}
                    />
                    <span className="text-muted hidden w-20 shrink-0 text-xs sm:block">
                      {format(parseISO(e.startedAt), "EEE, MMM d")}
                    </span>
                    <span
                      className="size-2 shrink-0 rounded-[2px]"
                      style={{ background: e.task.projectColor }}
                      aria-hidden
                    />
                    <span className="text-subtle hidden font-mono text-[11px] sm:inline">
                      {e.task.ref}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{e.note || e.task.title}</span>
                    <span className="tabular-nums">{formatDuration(e.seconds)}</span>
                  </Link>
                ))}
              </Card>
            </section>
          </>
        )}
      </div>
    </>
  );
}
