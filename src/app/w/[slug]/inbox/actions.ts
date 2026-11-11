"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; data?: string } | { ok: false; error: string };
const uuid = z.string().uuid();
const slugSchema = z.string().min(1).max(60);

export async function markAllRead(slug: string, workspaceId: string, kinds?: string[]) {
  const supabase = await createClient();
  let q = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .is("read_at", null);
  if (kinds?.length) q = q.in("kind", kinds);
  await q;
  revalidatePath(`/w/${slug}`, "layout");
}

/** Marks one notification read (when it is opened). Only your own: row level security checks that. */
export async function markRead(input: { slug: string; id: string }): Promise<Result> {
  const p = z.object({ slug: slugSchema, id: uuid }).safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid notification." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", p.data.id)
    .is("read_at", null);
  if (error) return { ok: false, error: "Couldn't update the notification." };
  revalidatePath(`/w/${p.data.slug}`, "layout");
  return { ok: true };
}

/** Moves a request out of Triage: into the first "to do" column (accept) or the canceled column (decline). */
export async function resolveRequest(input: {
  slug: string;
  taskId: string;
  decision: "accept" | "decline";
  assignToMe?: boolean;
}): Promise<Result> {
  const p = z
    .object({
      slug: slugSchema,
      taskId: uuid,
      decision: z.enum(["accept", "decline"]),
      assignToMe: z.boolean().optional(),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("id, project_id, task_statuses!inner(category)")
    .eq("id", p.data.taskId)
    .single();
  if (!task) return { ok: false, error: "That request no longer exists." };
  if (
    (task as unknown as { task_statuses: { category: string } }).task_statuses.category !== "triage"
  )
    return { ok: false, error: "Someone already handled this request." };

  const { data: statuses } = await supabase
    .from("task_statuses")
    .select("id, name, category, position")
    .eq("project_id", task.project_id)
    .order("position");
  const list = (statuses ?? []) as { id: string; name: string; category: string }[];
  const target =
    p.data.decision === "accept"
      ? (list.find((s) => s.category === "unstarted") ?? list.find((s) => s.category === "backlog"))
      : list.find((s) => s.category === "canceled");

  if (!target) {
    if (p.data.decision === "accept")
      return { ok: false, error: "This project has no To do or Backlog column to move it to." };
    // No canceled column: declining archives the request instead.
    const { error } = await supabase
      .from("tasks")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", p.data.taskId);
    if (error) return { ok: false, error: "You don't have permission to change this request." };
    revalidatePath(`/w/${p.data.slug}`, "layout");
    return { ok: true, data: "Archived" };
  }

  const { error } = await supabase.rpc("move_task", {
    p_task: p.data.taskId,
    p_status: target.id,
    p_before: null,
    p_after: null,
  });
  if (error) return { ok: false, error: "You don't have permission to change this request." };
  if (p.data.decision === "accept" && p.data.assignToMe) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await supabase.from("tasks").update({ assignee_id: user.id }).eq("id", p.data.taskId);
  }
  revalidatePath(`/w/${p.data.slug}`, "layout");
  return { ok: true, data: target.name };
}
