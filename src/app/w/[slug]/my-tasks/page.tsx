import type { Metadata } from "next";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { TaskGroup } from "@/components/tasks/task-list";
import { EmptyState } from "@/components/ui/surface";
import { myOpenTasks } from "@/lib/data/tasks";
import { plural } from "@/lib/plural";
import { getWorkspaceContext } from "@/lib/workspace";

export const metadata: Metadata = { title: "My tasks" };

// Same rule as the Overdue card on Home.
const isOverdue = (dueDate: string | null) =>
  dueDate != null && differenceInCalendarDays(parseISO(dueDate), new Date()) < 0;

export default async function MyTasksPage({
  params,
  searchParams,
}: PageProps<"/w/[slug]/my-tasks">) {
  const [{ slug }, { filter }] = await Promise.all([params, searchParams]);
  const { viewer, workspace } = await getWorkspaceContext(slug);
  const all = await myOpenTasks(workspace.id, viewer.id);
  const overdueOnly = filter === "overdue";
  const tasks = overdueOnly ? all.filter((t) => isOverdue(t.dueDate)) : all;
  const byProject = Map.groupBy(tasks, (t) => t.project.name);
  const base = `/w/${slug}/my-tasks`;
  const tab = (active: boolean) =>
    `rounded-control px-2.5 py-1 text-[13px] ${active ? "bg-elevated text-fg font-medium" : "text-muted hover:text-fg"}`;
  return (
    <>
      <PageHeader
        title="My tasks"
        description={
          overdueOnly
            ? `${plural(tasks.length, "overdue task")} assigned to you`
            : `${plural(tasks.length, "open task")} assigned to you`
        }
      />
      <nav aria-label="Filter tasks" className="flex gap-1 px-4 pt-3 pb-2 sm:px-8">
        <Link href={base} className={tab(!overdueOnly)} aria-current={!overdueOnly || undefined}>
          All open
        </Link>
        <Link
          href={`${base}?filter=overdue`}
          className={tab(overdueOnly)}
          aria-current={overdueOnly || undefined}
        >
          Overdue
        </Link>
      </nav>
      {tasks.length === 0 ? (
        overdueOnly ? (
          <EmptyState
            icon={<CheckCircle2 />}
            title="Nothing is overdue"
            description="None of your open tasks are past their due date."
          />
        ) : (
          <EmptyState
            icon={<CheckCircle2 />}
            title="Nothing assigned to you"
            description="Tasks assigned to you across every project show up here."
          />
        )
      ) : (
        [...byProject].map(([name, list]) => (
          <TaskGroup slug={slug} key={name} title={name} tasks={list} />
        ))
      )}
    </>
  );
}
