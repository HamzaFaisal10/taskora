"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loadTaskDetail } from "./task-detail";
import type { TaskDetail } from "./types";

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
  return { ok: true, data: null };
}

/** Full detail for the task panel, looked up by project and number (the "MOB-123" in the URL). */
export async function getTaskDetail(
  projectId: string,
  number: number,
): Promise<Result<TaskDetail>> {
  return loadTaskDetail(projectId, number);
}

/** Several subtasks in one round trip (used by the AI breakdown). */
export async function createSubtasks(input: {
  projectId: string;
  parentId: string;
  statusId: string | null;
  items: { title: string; estimate: number | null }[];
}): Promise<Result<number>> {
  const p = z
    .object({
      projectId: uuid,
      parentId: uuid,
      statusId: uuid.nullable(),
      items: z
        .array(
          z.object({
            title: z.string().trim().min(1).max(300),
            estimate: z.number().int().min(0).max(100).nullable(),
          }),
        )
        .min(1)
        .max(12),
    })
    .safeParse(input);
  if (!p.success) return fail("Invalid subtasks.");
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert(
    p.data.items.map((i) => ({
      project_id: p.data.projectId,
      parent_id: p.data.parentId,
      status_id: p.data.statusId ?? undefined,
      title: i.title,
      estimate: i.estimate,
    })),
  );
  if (error) return fail(message(error));
  return { ok: true, data: p.data.items.length };
}
