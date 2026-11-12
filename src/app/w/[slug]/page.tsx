import { differenceInCalendarDays, parseISO } from "date-fns";
import { Bell, CheckCircle2, FolderKanban } from "lucide-react";
import Link from "next/link";
import { NewProjectButton } from "@/components/shell/new-project";
import { PageHeader } from "@/components/shell/page-header";
import { TaskGroup } from "@/components/tasks/task-list";
import { Card, EmptyState } from "@/components/ui/surface";
import { myOpenTasks } from "@/lib/data/tasks";
import { getWorkspaceContext } from "@/lib/workspace";

const HEALTH = {
  on_track: { label: "On track", className: "text-success-text" },
  at_risk: { label: "At risk", className: "text-warning-text" },
  off_track: { label: "Off track", className: "text-danger-text" },
} as const;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function WorkspaceHome({ params }: PageProps<"/w/[slug]">) {
  const { slug } = await params;
  const { viewer, workspace, projects, unreadCount } = await getWorkspaceContext(slug);
  const tasks = await myOpenTasks(workspace.id, viewer.id);

  const days = (d: string | null) => (d ? differenceInCalendarDays(parseISO(d), new Date()) : null);
  const overdue = tasks.filter((t) => (days(t.dueDate) ?? 1) < 0);
  const today = tasks.filter((t) => days(t.dueDate) === 0);
  const week = tasks.filter((t) => {
    const n = days(t.dueDate);
    return n !== null && n > 0 && n <= 7;
  });
  const later = tasks.filter((t) => {
    const n = days(t.dueDate);
    return n === null || n > 7;
  });

  const stats = [
    { label: "Assigned to you", value: tasks.length, icon: CheckCircle2 },
    {
      label: "Overdue",
      value: overdue.length,
      icon: CheckCircle2,
      tone: overdue.length ? "text-danger-text" : undefined,
    },
    { label: "Unread updates", value: unreadCount, icon: Bell, href: `/w/${slug}/inbox` },
  ];

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${viewer.name.split(" ")[0]}`}
        description={`Here's what needs you in ${workspace.name}.`}
      />
      <div className="grid gap-3 px-4 py-5 sm:grid-cols-3 sm:px-8">
        {stats.map((s) => {
          const body = (
            <Card className="p-4">
              <div className="text-muted text-xs">{s.label}</div>
              <div className={`mt-1 text-2xl font-semibold tabular-nums ${s.tone ?? ""}`}>
                {s.value}
              </div>
            </Card>
          );
          return s.href ? (
            <Link key={s.label} href={s.href}>
              {body}
            </Link>
          ) : (
            <div key={s.label}>{body}</div>
          );
        })}
      </div>

      <div className="grid gap-6 pb-10 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="border-border xl:border-r">
          {tasks.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 />}
              title="You're all caught up"
              description="Nothing is assigned to you right now."
            />
          ) : (
            <>
              <TaskGroup slug={slug} title="Overdue" tasks={overdue} showProject />
              <TaskGroup slug={slug} title="Due today" tasks={today} showProject />
              <TaskGroup slug={slug} title="Next 7 days" tasks={week} showProject />
              <TaskGroup slug={slug} title="Later" tasks={later} showProject />
            </>
          )}
        </div>
        <aside className="px-4 sm:px-8 xl:px-0 xl:pr-8">
          <h2 className="mb-3 text-[13px] font-medium">Projects</h2>
          {projects.length === 0 ? (
            <Card>
              {workspace.role === "guest" ? (
                <EmptyState
                  icon={<FolderKanban />}
                  title="Nothing shared with you yet"
                  description="You'll see projects here once someone on the team shares one with you."
                />
              ) : (
                <EmptyState
                  icon={<FolderKanban />}
                  title="No projects yet"
                  description="Start blank or from a template with starter tasks."
                  action={<NewProjectButton />}
                />
              )}
            </Card>
          ) : (
            <ul className="space-y-2">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/w/${slug}/p/${p.key}`}
                    className="border-border bg-card hover:bg-elevated rounded-card flex items-center gap-3 border p-3 transition-colors"
                  >
                    <span
                      className="size-3 rounded-[4px]"
                      style={{ background: p.color }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                    <span className={`text-xs ${HEALTH[p.health].className}`}>
                      {HEALTH[p.health].label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </>
  );
}
