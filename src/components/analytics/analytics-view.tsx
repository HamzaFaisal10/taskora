"use client";

import { ArrowDownRight, ArrowUpRight, Download, Minus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, Progress } from "@/components/ui/surface";
import {
  byProject,
  byStatus,
  CATEGORY_LABEL,
  kpis,
  weekly,
  workload,
  type AnalyticsTask,
} from "@/lib/analytics/compute";
import { downloadCsv, toCsv } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FlowChart, StatusChart, WorkloadChart } from "./charts";

type Project = { id: string; key: string; name: string; color: string };

function Delta({
  now,
  before,
  betterWhenLower = false,
  unit = "",
}: {
  now: number | null;
  before: number | null;
  betterWhenLower?: boolean;
  unit?: string;
}) {
  if (now == null || before == null || before === 0)
    return <span className="text-subtle text-xs">No earlier data</span>;
  const diff = now - before;
  const pct = Math.round((diff / before) * 100);
  if (Math.abs(pct) < 1)
    return (
      <span className="text-subtle flex items-center gap-1 text-xs">
        <Minus className="size-3" aria-hidden />
        Same as the 30 days before
      </span>
    );
  const good = betterWhenLower ? diff < 0 : diff > 0;
  const Icon = diff > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs",
        good ? "text-success-text" : "text-danger-text",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {Math.abs(pct)}% {diff > 0 ? "more" : "less"} than the 30 days before{unit}
    </span>
  );
}

function Stat({
  label,
  value,
  children,
}: {
  label: string;
  value: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <p className="text-muted text-xs">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <div className="mt-1.5 min-h-4">{children}</div>
    </Card>
  );
}

export function AnalyticsView({
  tasks,
  people,
  projects,
  slug,
}: {
  tasks: AnalyticsTask[];
  people: { id: string; name: string }[];
  projects: Project[];
  slug: string;
}) {
  const [projectId, setProjectId] = useState<string>("all");
  const [weeks, setWeeks] = useState(8);

  const scoped = useMemo(
    () => (projectId === "all" ? tasks : tasks.filter((t) => t.projectId === projectId)),
    [tasks, projectId],
  );
  const k = useMemo(() => kpis(scoped), [scoped]);
  const flow = useMemo(() => weekly(scoped, weeks), [scoped, weeks]);
  const load = useMemo(
    () =>
      workload(scoped).map((w) => ({
        id: w.personId ?? "none",
        name: w.personId
          ? (people.find((p) => p.id === w.personId)?.name ?? "Former member")
          : "Unassigned",
        open: w.open,
        overdue: w.overdue,
        points: w.points,
      })),
    [scoped, people],
  );
  const perProject = useMemo(() => byProject(tasks), [tasks]);
  const statusRows = useMemo(() => byStatus(scoped), [scoped]);

  const exportCsv = () => {
    const today = new Date();
    const name = (id: string | null) =>
      id ? (people.find((p) => p.id === id)?.name ?? "Former member") : "";
    const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "";
    const header = [
      "Ref",
      "Title",
      "Project",
      "Status",
      "Stage",
      "Priority",
      "Assignee",
      "Estimate",
      "Created",
      "Completed",
      "Due",
      "Overdue",
    ];
    const rows = scoped.map((t) => [
      t.ref,
      t.title,
      projectName(t.projectId),
      t.status,
      CATEGORY_LABEL[t.category as keyof typeof CATEGORY_LABEL] ?? t.category,
      t.priority,
      name(t.assigneeId),
      t.estimate,
      t.createdAt.slice(0, 10),
      t.completedAt?.slice(0, 10),
      t.dueDate,
      !t.completedAt &&
      t.dueDate &&
      t.dueDate < today.toISOString().slice(0, 10) &&
      !["completed", "canceled"].includes(t.category)
        ? "yes"
        : "",
    ]);
    const scope =
      projectId === "all" ? slug : (projects.find((p) => p.id === projectId)?.key ?? slug);
    downloadCsv(
      `taskora-${scope.toLowerCase()}-tasks-${today.toISOString().slice(0, 10)}.csv`,
      toCsv([header, ...rows]),
    );
  };

  const sel = "border-border bg-card rounded-control h-8 border px-2.5 text-[13px]";

  return (
    <>
      <PageHeader
        title="Analytics"
        description="How work is flowing across the workspace."
        actions={
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filters">
            <select
              aria-label="Project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={sel}
            >
              <option value="all">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Time range"
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
              className={sel}
            >
              <option value={4}>Last 4 weeks</option>
              <option value={8}>Last 8 weeks</option>
              <option value={12}>Last 12 weeks</option>
            </select>
            <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!scoped.length}>
              <Download /> Export CSV
            </Button>
          </div>
        }
      />
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 pb-12 sm:px-8">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Completed · last 30 days" value={k.completed}>
            <Delta now={k.completed} before={k.completedBefore} />
          </Stat>
          <Stat
            label="Median cycle time"
            value={k.cycleDays == null ? "–" : `${k.cycleDays.toFixed(1)} days`}
          >
            <Delta now={k.cycleDays} before={k.cycleDaysBefore} betterWhenLower />
          </Stat>
          <Stat label="Open tasks" value={k.open}>
            <span className="text-subtle text-xs">
              Across {projectId === "all" ? `${projects.length} projects` : "this project"}
            </span>
          </Stat>
          <Stat
            label="Overdue"
            value={<span className={k.overdue ? "text-danger-text" : undefined}>{k.overdue}</span>}
          >
            <span className="text-subtle text-xs">
              {k.open ? `${Math.round((k.overdue / k.open) * 100)}% of open work` : "Nothing open"}
            </span>
          </Stat>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card className="p-5">
            <FlowChart data={flow} />
          </Card>
          <Card className="p-5">
            <WorkloadChart rows={load} />
          </Card>
        </div>

        <Card className="p-5">
          <StatusChart rows={statusRows} />
        </Card>

        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="px-5 pt-4 pb-2 text-left text-sm font-semibold">Projects</caption>
            <thead>
              <tr className="text-subtle border-border border-b text-left text-xs">
                <th className="px-5 py-2 font-medium">Project</th>
                <th className="py-2 font-medium">Progress</th>
                <th className="py-2 text-right font-medium">Open</th>
                <th className="py-2 text-right font-medium">Done · 30d</th>
                <th className="px-5 py-2 text-right font-medium">Overdue</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const s = perProject.find((x) => x.projectId === p.id);
                const pct = s && s.total ? Math.round((s.done / s.total) * 100) : 0;
                return (
                  <tr
                    key={p.id}
                    className="border-border-subtle hover:bg-surface border-b last:border-0"
                  >
                    <td className="px-5 py-2.5">
                      <Link
                        href={`/w/${slug}/p/${p.key}`}
                        className="flex items-center gap-2 font-medium hover:underline"
                      >
                        <span
                          className="size-2.5 rounded-[3px]"
                          style={{ background: p.color }}
                          aria-hidden
                        />
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Progress
                          value={pct}
                          className="h-1.5 w-28"
                          label={`${p.name}: ${pct}% done`}
                        />
                        <span className="text-muted text-xs tabular-nums">{pct}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{s?.open ?? 0}</td>
                    <td className="py-2.5 text-right tabular-nums">{s?.completedRecent ?? 0}</td>
                    <td
                      className={cn(
                        "px-5 py-2.5 text-right tabular-nums",
                        s?.overdue ? "text-danger-text font-medium" : "text-muted",
                      )}
                    >
                      {s?.overdue ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
