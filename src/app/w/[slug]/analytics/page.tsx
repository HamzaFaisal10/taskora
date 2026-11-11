import type { Metadata } from "next";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import type { AnalyticsTask } from "@/lib/analytics/compute";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({ params }: PageProps<"/w/[slug]/analytics">) {
  const { slug } = await params;
  const { workspace, projects } = await getWorkspaceContext(slug);
  const supabase = await createClient();

  const [tasks, members] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, project_id, assignee_id, created_at, completed_at, due_date, estimate, task_statuses!inner(category)",
      )
      .eq("workspace_id", workspace.id)
      .is("archived_at", null)
      .is("parent_id", null)
      .limit(5000),
    supabase
      .from("workspace_members")
      .select("profiles!inner(id, full_name)")
      .eq("workspace_id", workspace.id),
  ]);

  type Row = {
    id: string;
    project_id: string;
    assignee_id: string | null;
    created_at: string;
    completed_at: string | null;
    due_date: string | null;
    estimate: number | null;
    task_statuses: { category: string };
  };
  const rows: AnalyticsTask[] = ((tasks.data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    projectId: r.project_id,
    assigneeId: r.assignee_id,
    createdAt: r.created_at,
    completedAt: r.completed_at,
    dueDate: r.due_date,
    estimate: r.estimate,
    category: r.task_statuses.category,
  }));
  type M = { profiles: { id: string; full_name: string } };
  const people = ((members.data ?? []) as unknown as M[]).map((m) => ({
    id: m.profiles.id,
    name: m.profiles.full_name,
  }));

  return (
    <AnalyticsView
      tasks={rows}
      people={people}
      projects={projects.map((p) => ({ id: p.id, key: p.key, name: p.name, color: p.color }))}
      slug={slug}
    />
  );
}
