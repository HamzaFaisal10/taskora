import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { Person, TaskDetail } from "./types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const uuid = z.string().uuid();
const fail = (error: string): Result<never> => ({ ok: false, error });

type PersonRow = { id: string; full_name: string; avatar_url: string | null } | null;
const person = (p: PersonRow): Person | null =>
  p ? { id: p.id, name: p.full_name || "Unnamed", avatarUrl: p.avatar_url } : null;

/** Full detail for the task panel, looked up by project and number (the "MOB-123" in the URL). */
export async function loadTaskDetail(
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

  const [parent, children, deps, comments, activity, time, files] = await Promise.all([
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
        "id, body, created_at, edited_at, author:profiles!comments_author_id_fkey(id, full_name, avatar_url), comment_reactions(emoji, user_id)",
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
    supabase
      .from("time_entries")
      .select(
        "id, started_at, ended_at, duration_seconds, note, user:profiles!time_entries_user_id_fkey(id, full_name, avatar_url)",
      )
      .eq("task_id", row.id)
      .order("started_at", { ascending: false })
      .limit(50),
    supabase
      .from("attachments")
      .select(
        "id, file_name, storage_path, size_bytes, mime_type, created_at, uploader:profiles!attachments_uploaded_by_fkey(id, full_name, avatar_url)",
      )
      .eq("task_id", row.id)
      .order("created_at"),
  ]);
  type F = {
    id: string;
    file_name: string;
    storage_path: string;
    size_bytes: number;
    mime_type: string;
    created_at: string;
    uploader: PersonRow;
  };
  type T = {
    id: string;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number | null;
    note: string;
    user: PersonRow;
  };

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
    comment_reactions: { emoji: string; user_id: string }[];
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
      attachments: ((files.data ?? []) as unknown as F[]).map((f) => ({
        id: f.id,
        fileName: f.file_name,
        path: f.storage_path,
        sizeBytes: Number(f.size_bytes),
        mimeType: f.mime_type,
        createdAt: f.created_at,
        uploader: person(f.uploader),
      })),
      time: ((time.data ?? []) as unknown as T[]).map((e) => ({
        id: e.id,
        user: person(e.user),
        startedAt: e.started_at,
        endedAt: e.ended_at,
        durationSeconds: e.duration_seconds,
        note: e.note,
      })),
      commentList: ((comments.data ?? []) as unknown as C[]).map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.created_at,
        editedAt: c.edited_at,
        author: person(c.author),
        reactions: Object.entries(
          (c.comment_reactions ?? []).reduce<Record<string, string[]>>((acc, r) => {
            (acc[r.emoji] ??= []).push(r.user_id);
            return acc;
          }, {}),
        ).map(([emoji, userIds]) => ({ emoji, userIds })),
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
