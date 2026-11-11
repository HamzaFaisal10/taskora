"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Person, TaskDetail } from "./types";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

const uuid = z.string().uuid();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

const fail = (error: string): Result<never> => ({ ok: false, error });
const message = (e: { message?: string; code?: string } | null) =>
  e?.code === "42501" || /row-level security/i.test(e?.message ?? "")
    ? "You don't have permission to change this."
    : "Something went wrong. Please try again.";

function refresh(path: string) {
  revalidatePath(path, "layout");
}

export async function moveTask(input: {
  path: string;
  taskId: string;
  statusId: string;
  beforeId: string | null;
  afterId: string | null;
}): Promise<Result<number>> {
  const p = z
    .object({ taskId: uuid, statusId: uuid, beforeId: uuid.nullable(), afterId: uuid.nullable() })
    .safeParse(input);
  if (!p.success) return fail("Invalid move.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("move_task", {
    p_task: p.data.taskId,
    p_status: p.data.statusId,
    p_before: p.data.beforeId,
    p_after: p.data.afterId,
  });
  if (error) return fail(message(error));
  refresh(input.path);
  return { ok: true, data: data as number };
}

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    description: z.string().max(50000),
    statusId: uuid,
    priority: z.enum(["none", "low", "medium", "high", "urgent"]),
    assigneeId: uuid.nullable(),
    sprintId: uuid.nullable(),
    startDate: date,
    dueDate: date,
    estimate: z.number().int().min(0).max(100).nullable(),
  })
  .partial();

export type TaskPatch = z.infer<typeof patchSchema>;

const COLUMNS: Record<keyof TaskPatch, string> = {
  title: "title",
  description: "description",
  statusId: "status_id",
  priority: "priority",
  assigneeId: "assignee_id",
  sprintId: "sprint_id",
  startDate: "start_date",
  dueDate: "due_date",
  estimate: "estimate",
};

export async function updateTask(input: {
  path: string;
  taskId: string;
  patch: TaskPatch;
}): Promise<Result> {
  const id = uuid.safeParse(input.taskId);
  const patch = patchSchema.safeParse(input.patch);
  if (!id.success || !patch.success) return fail("Invalid change.");
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch.data)) row[COLUMNS[k as keyof TaskPatch]] = v;
  if (row.start_date && row.due_date && String(row.start_date) > String(row.due_date))
    return fail("Start date must be before the due date.");

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update(row).eq("id", id.data);
  if (error)
    return fail(
      error.message.includes("due_date")
        ? "Start date must be before the due date."
        : message(error),
    );
  refresh(input.path);
  return { ok: true, data: null };
}

export async function createTask(input: {
  path: string;
  projectId: string;
  title: string;
  statusId?: string;
  dueDate?: string | null;
  parentId?: string | null;
  assigneeId?: string | null;
  estimate?: number | null;
}): Promise<Result<{ id: string; number: number }>> {
  const p = z
    .object({
      projectId: uuid,
      title: z.string().trim().min(1, "Give the task a title.").max(300),
      statusId: uuid.optional(),
      dueDate: date.optional(),
      parentId: uuid.nullable().optional(),
      assigneeId: uuid.nullable().optional(),
      estimate: z.number().int().min(0).max(100).nullable().optional(),
    })
    .safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      project_id: p.data.projectId,
      title: p.data.title,
      status_id: p.data.statusId,
      due_date: p.data.dueDate ?? null,
      parent_id: p.data.parentId ?? null,
      assignee_id: p.data.assigneeId ?? null,
      estimate: p.data.estimate ?? null,
    })
    .select("id, number")
    .single();
  if (error) return fail(message(error));
  refresh(input.path);
  return { ok: true, data };
}

export async function archiveTask(input: { path: string; taskId: string }): Promise<Result> {
  const id = uuid.safeParse(input.taskId);
  if (!id.success) return fail("Invalid task.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id.data);
  if (error) return fail(message(error));
  refresh(input.path);
  return { ok: true, data: null };
}

export async function setTaskLabels(input: {
  path: string;
  taskId: string;
  labelIds: string[];
}): Promise<Result> {
  const p = z.object({ taskId: uuid, labelIds: z.array(uuid).max(20) }).safeParse(input);
  if (!p.success) return fail("Invalid labels.");
  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("task_labels")
    .select("label_id")
    .eq("task_id", p.data.taskId);
  if (readError) return fail(message(readError));
  const have = new Set((current ?? []).map((r) => r.label_id as string));
  const want = new Set(p.data.labelIds);
  const add = [...want].filter((id) => !have.has(id));
  const remove = [...have].filter((id) => !want.has(id));
  if (add.length) {
    const { error } = await supabase
      .from("task_labels")
      .insert(add.map((label_id) => ({ task_id: p.data.taskId, label_id })));
    if (error) return fail(message(error));
  }
  if (remove.length) {
    const { error } = await supabase
      .from("task_labels")
      .delete()
      .eq("task_id", p.data.taskId)
      .in("label_id", remove);
    if (error) return fail(message(error));
  }
  refresh(input.path);
  return { ok: true, data: null };
}

export async function addComment(input: {
  path: string;
  taskId: string;
  body: string;
}): Promise<Result> {
  const p = z
    .object({ taskId: uuid, body: z.string().trim().min(1, "Write a comment first.").max(10000) })
    .safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("comments")
    .insert({ task_id: p.data.taskId, body: p.data.body, author_id: user?.id });
  if (error) return fail(message(error));
  refresh(input.path);
  return { ok: true, data: null };
}

type PersonRow = { id: string; full_name: string; avatar_url: string | null } | null;
const person = (p: PersonRow): Person | null =>
  p ? { id: p.id, name: p.full_name || "Unnamed", avatarUrl: p.avatar_url } : null;

/** Full detail for the task panel, looked up by project and number (the "MOB-123" in the URL). */
export async function getTaskDetail(
  projectId: string,
  number: number,
): Promise<Result<TaskDetail>> {
  const p = z
    .object({ projectId: uuid, number: z.number().int().positive() })
    .safeParse({ projectId, number });
  if (!p.success) return fail("Invalid task.");
  const supabase = await createClient();

  const { data: t, error } = await supabase
    .from("tasks")
    .select(
      "id, number, title, description, status_id, priority, assignee_id, sprint_id, parent_id, start_date, due_date, estimate, position, completed_at, created_at, projects!inner(key), creator:profiles!tasks_creator_id_fkey(id, full_name, avatar_url), task_labels(label_id)",
    )
    .eq("project_id", p.data.projectId)
    .eq("number", p.data.number)
    .is("archived_at", null)
    .maybeSingle();
  if (error || !t) return fail("This task doesn't exist or was archived.");

  type Row = typeof t & {
    projects: { key: string };
    creator: PersonRow;
    task_labels: { label_id: string }[];
  };
  const row = t as unknown as Row;
  const key = row.projects.key;

  const [parent, children, deps, comments, activity] = await Promise.all([
    row.parent_id
      ? supabase.from("tasks").select("id, number, title").eq("id", row.parent_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("tasks")
      .select("id, number, title, status_id, assignee_id, task_statuses!inner(category)")
      .eq("parent_id", row.id)
      .is("archived_at", null)
      .order("created_at"),
    supabase
      .from("task_dependencies")
      .select(
        "blocker:tasks!task_dependencies_blocked_by_id_fkey(id, number, title, completed_at, projects!inner(key))",
      )
      .eq("task_id", row.id),
    supabase
      .from("comments")
      .select(
        "id, body, created_at, edited_at, author:profiles!comments_author_id_fkey(id, full_name, avatar_url)",
      )
      .eq("task_id", row.id)
      .order("created_at"),
    supabase
      .from("activity")
      .select(
        "id, action, meta, created_at, actor:profiles!activity_actor_id_fkey(id, full_name, avatar_url)",
      )
      .eq("task_id", row.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  type Child = {
    id: string;
    number: number;
    title: string;
    status_id: string;
    assignee_id: string | null;
    task_statuses: { category: string };
  };
  type Dep = {
    blocker: {
      id: string;
      number: number;
      title: string;
      completed_at: string | null;
      projects: { key: string };
    } | null;
  };
  type C = {
    id: string;
    body: string;
    created_at: string;
    edited_at: string | null;
    author: PersonRow;
  };
  type A = {
    id: string;
    action: string;
    meta: Record<string, unknown>;
    created_at: string;
    actor: PersonRow;
  };
  const childRows = (children.data ?? []) as unknown as Child[];
  const par = parent.data as { id: string; number: number; title: string } | null;

  return {
    ok: true,
    data: {
      id: row.id,
      number: row.number,
      ref: `${key}-${row.number}`,
      title: row.title,
      description: row.description,
      statusId: row.status_id,
      priority: row.priority,
      assigneeId: row.assignee_id,
      sprintId: row.sprint_id,
      startDate: row.start_date,
      dueDate: row.due_date,
      estimate: row.estimate,
      position: row.position,
      labelIds: row.task_labels.map((l) => l.label_id),
      subtasks: {
        total: childRows.length,
        done: childRows.filter((c) => c.task_statuses.category === "completed").length,
      },
      comments: (comments.data ?? []).length,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      creator: person(row.creator),
      parent: par ? { id: par.id, ref: `${key}-${par.number}`, title: par.title } : null,
      children: childRows.map((c) => ({
        id: c.id,
        ref: `${key}-${c.number}`,
        title: c.title,
        statusId: c.status_id,
        assigneeId: c.assignee_id,
      })),
      blockedBy: ((deps.data ?? []) as unknown as Dep[])
        .filter((d) => d.blocker)
        .map((d) => ({
          id: d.blocker!.id,
          ref: `${d.blocker!.projects.key}-${d.blocker!.number}`,
          title: d.blocker!.title,
          done: !!d.blocker!.completed_at,
        })),
      commentList: ((comments.data ?? []) as unknown as C[]).map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.created_at,
        editedAt: c.edited_at,
        author: person(c.author),
      })),
      activity: ((activity.data ?? []) as unknown as A[]).map((a) => ({
        id: a.id,
        action: a.action,
        meta: a.meta,
        createdAt: a.created_at,
        actor: person(a.actor),
      })),
    },
  };
}
