import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Priority } from "@/components/tasks/task-meta";

export type TaskListItem = {
  id: string;
  ref: string;
  title: string;
  priority: Priority;
  dueDate: string | null;
  status: { name: string; color: string; category: string };
  project: { key: string; name: string; color: string };
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
};

const SELECT =
  "id, number, title, priority, due_date, task_statuses!inner(name, color, category, position), projects!inner(key, name, color), assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url)";

type Row = {
  id: string;
  number: number;
  title: string;
  priority: Priority;
  due_date: string | null;
  task_statuses: { name: string; color: string; category: string; position: number };
  projects: { key: string; name: string; color: string };
  assignee: { id: string; full_name: string; avatar_url: string | null } | null;
};

const toItem = (r: Row): TaskListItem => ({
  id: r.id,
  ref: `${r.projects.key}-${r.number}`,
  title: r.title,
  priority: r.priority,
  dueDate: r.due_date,
  status: r.task_statuses,
  project: r.projects,
  assignee: r.assignee
    ? { id: r.assignee.id, name: r.assignee.full_name, avatarUrl: r.assignee.avatar_url }
    : null,
});

/** Open, top-level tasks assigned to the user in this workspace. */
export async function myOpenTasks(workspaceId: string, userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(SELECT)
    .eq("workspace_id", workspaceId)
    .eq("assignee_id", userId)
    .is("archived_at", null)
    .is("parent_id", null)
    .not("task_statuses.category", "in", "(completed,canceled)")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(200);
  if (error) throw error;
  return (data as unknown as Row[]).map(toItem);
}

/** Top-level tasks in a project, ordered by status then position. */
export async function projectTasks(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(SELECT)
    .eq("project_id", projectId)
    .is("archived_at", null)
    .is("parent_id", null)
    .order("position")
    .limit(500);
  if (error) throw error;
  return (data as unknown as Row[])
    .sort((a, b) => a.task_statuses.position - b.task_statuses.position)
    .map(toItem);
}
