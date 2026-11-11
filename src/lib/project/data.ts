import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";
import type { BoardTask, Label, Person, ProjectData, Sprint, Status } from "./types";

type TaskRow = {
  id: string;
  number: number;
  title: string;
  status_id: string;
  priority: BoardTask["priority"];
  assignee_id: string | null;
  sprint_id: string | null;
  parent_id: string | null;
  start_date: string | null;
  due_date: string | null;
  estimate: number | null;
  position: number;
  completed_at: string | null;
  created_at: string;
  task_labels: { label_id: string }[];
  comments: { count: number }[];
};

/** Everything the board, list, calendar and timeline views need, loaded once per request. */
export const getProjectData = cache(async (slug: string, key: string): Promise<ProjectData> => {
  const { workspace } = await getWorkspaceContext(slug);
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, key, name, color, description, workspace_id")
    .eq("workspace_id", workspace.id)
    .eq("key", key.toUpperCase())
    .is("archived_at", null)
    .maybeSingle();
  if (!project) notFound();

  const [statuses, tasks, members, labels, sprints] = await Promise.all([
    supabase
      .from("task_statuses")
      .select("id, name, color, category, position")
      .eq("project_id", project.id)
      .order("position"),
    supabase
      .from("tasks")
      .select(
        "id, number, title, status_id, priority, assignee_id, sprint_id, parent_id, start_date, due_date, estimate, position, completed_at, created_at, task_labels(label_id), comments(count)",
      )
      .eq("project_id", project.id)
      .is("archived_at", null)
      .order("position")
      .limit(2000),
    supabase
      .from("workspace_members")
      .select("role, profiles!inner(id, full_name, avatar_url)")
      .eq("workspace_id", workspace.id),
    supabase.from("labels").select("id, name, tone").eq("workspace_id", workspace.id).order("name"),
    supabase
      .from("sprints")
      .select("id, name, state, start_date, end_date")
      .eq("project_id", project.id)
      .order("start_date"),
  ]);
  if (tasks.error) throw tasks.error;

  const statusList = (statuses.data ?? []) as Status[];
  const doneIds = new Set(
    statusList
      .filter((s) => s.category === "completed" || s.category === "canceled")
      .map((s) => s.id),
  );
  const rows = (tasks.data ?? []) as unknown as TaskRow[];

  const subtaskCounts = new Map<string, { total: number; done: number }>();
  for (const r of rows) {
    if (!r.parent_id) continue;
    const c = subtaskCounts.get(r.parent_id) ?? { total: 0, done: 0 };
    c.total += 1;
    if (doneIds.has(r.status_id)) c.done += 1;
    subtaskCounts.set(r.parent_id, c);
  }

  type MemberRow = {
    role: string;
    profiles: { id: string; full_name: string; avatar_url: string | null };
  };
  const people: Person[] = ((members.data ?? []) as unknown as MemberRow[])
    .map((m) => ({
      id: m.profiles.id,
      name: m.profiles.full_name || "Unnamed",
      avatarUrl: m.profiles.avatar_url,
      role: m.role,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    project: {
      id: project.id,
      key: project.key,
      name: project.name,
      color: project.color,
      description: project.description,
      workspaceId: project.workspace_id,
    },
    statuses: statusList,
    tasks: rows
      .filter((r) => !r.parent_id)
      .map((r) => ({
        id: r.id,
        number: r.number,
        ref: `${project.key}-${r.number}`,
        title: r.title,
        statusId: r.status_id,
        priority: r.priority,
        assigneeId: r.assignee_id,
        sprintId: r.sprint_id,
        startDate: r.start_date,
        dueDate: r.due_date,
        estimate: r.estimate,
        position: r.position,
        labelIds: r.task_labels.map((l) => l.label_id),
        subtasks: subtaskCounts.get(r.id) ?? { total: 0, done: 0 },
        comments: r.comments[0]?.count ?? 0,
        completedAt: r.completed_at,
        createdAt: r.created_at,
      })),
    people,
    labels: (labels.data ?? []) as Label[],
    sprints: (
      (sprints.data ?? []) as {
        id: string;
        name: string;
        state: Sprint["state"];
        start_date: string;
        end_date: string;
      }[]
    ).map((s) => ({
      id: s.id,
      name: s.name,
      state: s.state,
      startDate: s.start_date,
      endDate: s.end_date,
    })),
    canEdit: workspace.role !== "guest",
  };
});
