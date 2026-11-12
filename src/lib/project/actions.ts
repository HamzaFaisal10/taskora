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
    title: z
      .string()
      .trim()
      .min(1, "Give the task a title.")
      .max(300, "Keep the title under 300 characters."),
    description: z.string().max(50000, "The description is too long (50,000 characters at most)."),
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
  if (!id.success) return fail("Invalid change.");
  if (!patch.success) return fail(patch.error.issues[0]?.message ?? "Invalid change.");
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch.data)) row[COLUMNS[k as keyof TaskPatch]] = v;
  if (row.start_date && row.due_date && String(row.start_date) > String(row.due_date))
    return fail("Start date must be before the due date.");

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update(row).eq("id", id.data);
  if (error)
    return fail(
      error.code === "23514" || /due_date|start_date/.test(error.message)
        ? "The start date must be on or before the due date."
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
      title: z
        .string()
        .trim()
        .min(1, "Give the task a title.")
        .max(300, "Keep the title under 300 characters."),
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

export async function restoreTask(input: { path: string; taskId: string }): Promise<Result> {
  const id = uuid.safeParse(input.taskId);
  if (!id.success) return fail("Invalid task.");
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ archived_at: null }).eq("id", id.data);
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
    .object({
      taskId: uuid,
      body: z
        .string()
        .trim()
        .min(1, "Write a comment first.")
        .max(10000, "Keep comments under 10,000 characters."),
    })
    .safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in first.");
  const { error } = await supabase
    .from("comments")
    .insert({ task_id: p.data.taskId, body: p.data.body, author_id: user.id });
  if (error) return fail(message(error));

  // @mentions: "@Full Name" for any workspace member notifies them (never yourself).
  if (p.data.body.includes("@")) {
    const { data: task } = await supabase
      .from("tasks")
      .select("workspace_id, number, projects!inner(key)")
      .eq("id", p.data.taskId)
      .single();
    if (task) {
      const t = task as unknown as {
        workspace_id: string;
        number: number;
        projects: { key: string };
      };
      const { data: members } = await supabase
        .from("workspace_members")
        .select("user_id, profiles!inner(full_name)")
        .eq("workspace_id", t.workspace_id);
      type M = { user_id: string; profiles: { full_name: string } };
      const mentioned = ((members ?? []) as unknown as M[]).filter(
        (m) =>
          m.user_id !== user.id &&
          m.profiles.full_name &&
          p.data.body.toLowerCase().includes(`@${m.profiles.full_name.toLowerCase()}`),
      );
      if (mentioned.length) {
        await supabase.from("notifications").insert(
          mentioned.map((m) => ({
            user_id: m.user_id,
            workspace_id: t.workspace_id,
            kind: "mentioned",
            task_id: p.data.taskId,
            actor_id: user.id,
            title: `mentioned you on ${t.projects.key}-${t.number}`,
            body: p.data.body.slice(0, 280),
          })),
        );
      }
    }
  }
  return { ok: true, data: null };
}

const EMOJI = ["👍", "🎉", "❤️", "👀", "✅", "🚀"] as const;

/** Adds or removes your reaction on a comment. */
export async function toggleReaction(input: { commentId: string; emoji: string }): Promise<Result> {
  const p = z.object({ commentId: uuid, emoji: z.enum(EMOJI) }).safeParse(input);
  if (!p.success) return fail("Invalid reaction.");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in first.");
  const { count } = await supabase
    .from("comment_reactions")
    .delete({ count: "exact" })
    .eq("comment_id", p.data.commentId)
    .eq("user_id", user.id)
    .eq("emoji", p.data.emoji);
  if (!count) {
    const { error } = await supabase
      .from("comment_reactions")
      .insert({ comment_id: p.data.commentId, user_id: user.id, emoji: p.data.emoji });
    if (error) return fail(message(error));
  }
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

export async function addDependency(input: {
  taskId: string;
  blockedById: string;
}): Promise<Result> {
  const p = z.object({ taskId: uuid, blockedById: uuid }).safeParse(input);
  if (!p.success || p.data.taskId === p.data.blockedById) return fail("A task can't block itself.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_dependencies")
    .insert({ task_id: p.data.taskId, blocked_by_id: p.data.blockedById });
  if (error) {
    if (error.code === "23505") return fail("That task already blocks this one.");
    if (/block each other|loop|cycle/i.test(error.message))
      return fail("Those tasks would wait on each other. Remove the other dependency first.");
    if (/same workspace/i.test(error.message))
      return fail("Blockers must be in the same workspace.");
    return fail(message(error));
  }
  return { ok: true, data: null };
}

export async function removeDependency(input: {
  taskId: string;
  blockedById: string;
}): Promise<Result> {
  const p = z.object({ taskId: uuid, blockedById: uuid }).safeParse(input);
  if (!p.success) return fail("Invalid dependency.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_dependencies")
    .delete()
    .eq("task_id", p.data.taskId)
    .eq("blocked_by_id", p.data.blockedById);
  if (error) return fail(message(error));
  return { ok: true, data: null };
}

/** Adds the tasks drafted from a brief, in one round trip. */
export async function createPlannedTasks(input: {
  projectId: string;
  statusId: string | null;
  sprintId: string | null;
  tasks: {
    title: string;
    priority: "low" | "medium" | "high" | "urgent";
    estimate: number | null;
    labelIds: string[];
  }[];
}): Promise<Result<number>> {
  const p = z
    .object({
      projectId: uuid,
      statusId: uuid.nullable(),
      sprintId: uuid.nullable(),
      tasks: z
        .array(
          z.object({
            title: z.string().trim().min(1).max(300),
            priority: z.enum(["low", "medium", "high", "urgent"]),
            estimate: z.number().int().min(0).max(100).nullable(),
            labelIds: z.array(uuid).max(10),
          }),
        )
        .min(1, "Pick at least one task.")
        .max(20),
    })
    .safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Invalid tasks.");
  const supabase = await createClient();
  // Ids are generated here so labels can be attached without reading the new rows back.
  const rows = p.data.tasks.map((t) => ({ ...t, id: crypto.randomUUID() }));
  const { error } = await supabase.from("tasks").insert(
    rows.map((t) => ({
      id: t.id,
      project_id: p.data.projectId,
      status_id: p.data.statusId ?? undefined,
      sprint_id: p.data.sprintId,
      title: t.title,
      priority: t.priority,
      estimate: t.estimate,
      source: "ai",
    })),
  );
  if (error) return fail(message(error));
  const labels = rows.flatMap((t) => t.labelIds.map((label_id) => ({ task_id: t.id, label_id })));
  if (labels.length) {
    const { error: labelError } = await supabase.from("task_labels").insert(labels);
    if (labelError) return fail(message(labelError));
  }
  return { ok: true, data: rows.length };
}

const idList = z.array(uuid).min(1).max(500);

/** Applies the same change to several tasks at once (list view bulk edit). */
export async function bulkUpdateTasks(input: {
  path: string;
  taskIds: string[];
  patch: Pick<TaskPatch, "statusId" | "priority" | "assigneeId" | "sprintId" | "dueDate">;
}): Promise<Result<number>> {
  const ids = idList.safeParse(input.taskIds);
  const patch = patchSchema
    .pick({ statusId: true, priority: true, assigneeId: true, sprintId: true, dueDate: true })
    .safeParse(input.patch);
  if (!ids.success || !patch.success || !Object.keys(patch.data).length)
    return fail("Invalid change.");
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch.data)) row[COLUMNS[k as keyof TaskPatch]] = v;
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("tasks")
    .update(row, { count: "exact" })
    .in("id", ids.data);
  if (error)
    return fail(
      /due_date/.test(error.message)
        ? "Some tasks start after that due date. Change their start dates first."
        : message(error),
    );
  return { ok: true, data: count ?? ids.data.length };
}

export async function archiveTasks(input: {
  path: string;
  taskIds: string[];
}): Promise<Result<number>> {
  const ids = idList.safeParse(input.taskIds);
  if (!ids.success) return fail("Invalid tasks.");
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("tasks")
    .update({ archived_at: new Date().toISOString() }, { count: "exact" })
    .in("id", ids.data);
  if (error) return fail(message(error));
  return { ok: true, data: count ?? ids.data.length };
}

/** Creates tasks from an imported CSV file (already matched to statuses, people and labels). */
export async function importTasks(input: {
  projectId: string;
  tasks: {
    title: string;
    description: string;
    statusId: string | null;
    priority: "none" | "low" | "medium" | "high" | "urgent";
    assigneeId: string | null;
    dueDate: string | null;
    estimate: number | null;
    labelIds: string[];
  }[];
}): Promise<Result<number>> {
  const p = z
    .object({
      projectId: uuid,
      tasks: z
        .array(
          z.object({
            title: z.string().trim().min(1).max(300),
            description: z.string().max(50000),
            statusId: uuid.nullable(),
            priority: z.enum(["none", "low", "medium", "high", "urgent"]),
            assigneeId: uuid.nullable(),
            dueDate: date,
            estimate: z.number().int().min(0).max(100).nullable(),
            labelIds: z.array(uuid).max(10),
          }),
        )
        .min(1, "There are no tasks to import.")
        .max(500, "Import up to 500 tasks at a time."),
    })
    .safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Invalid import.");
  const supabase = await createClient();
  const rows = p.data.tasks.map((t) => ({ ...t, id: crypto.randomUUID() }));
  // Insert in chunks so one request never gets too large.
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await supabase.from("tasks").insert(
      chunk.map((t) => ({
        id: t.id,
        project_id: p.data.projectId,
        title: t.title,
        description: t.description,
        status_id: t.statusId ?? undefined,
        priority: t.priority,
        assignee_id: t.assigneeId,
        due_date: t.dueDate,
        estimate: t.estimate,
        source: "import",
      })),
    );
    if (error)
      return fail(
        i === 0 ? message(error) : `Imported ${i} tasks, then stopped: ${message(error)}`,
      );
  }
  const labels = rows.flatMap((t) => t.labelIds.map((label_id) => ({ task_id: t.id, label_id })));
  for (let i = 0; i < labels.length; i += 500) {
    await supabase.from("task_labels").insert(labels.slice(i, i + 500));
  }
  return { ok: true, data: rows.length };
}
