"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };
const uuid = z.string().uuid();
const category = z.enum([
  "triage",
  "backlog",
  "unstarted",
  "started",
  "review",
  "completed",
  "canceled",
]);
const denied = "You don't have permission to change this project's columns.";

export async function saveStatus(input: {
  path: string;
  projectId: string;
  id?: string;
  newId?: string;
  name: string;
  color: string;
  category: string;
  position?: number;
}): Promise<Result> {
  const p = z
    .object({
      projectId: uuid,
      id: uuid.optional(),
      newId: uuid.optional(),
      name: z.string().trim().min(1, "Name the column.").max(40),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
      category,
      position: z.number().int().optional(),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const supabase = await createClient();
  const row = { name: p.data.name, color: p.data.color, category: p.data.category };
  const { error } = p.data.id
    ? await supabase.from("task_statuses").update(row).eq("id", p.data.id)
    : await supabase.from("task_statuses").insert({
        ...row,
        id: p.data.newId,
        project_id: p.data.projectId,
        position: p.data.position ?? 99,
      });
  if (error) return { ok: false, error: denied };
  revalidatePath(input.path, "layout");
  return { ok: true };
}

export async function reorderStatuses(input: { path: string; ids: string[] }): Promise<Result> {
  const p = z.array(uuid).max(30).safeParse(input.ids);
  if (!p.success) return { ok: false, error: "Invalid order." };
  const supabase = await createClient();
  const results = await Promise.all(
    p.data.map((id, i) => supabase.from("task_statuses").update({ position: i }).eq("id", id)),
  );
  if (results.some((r) => r.error)) return { ok: false, error: denied };
  revalidatePath(input.path, "layout");
  return { ok: true };
}

export async function deleteStatus(input: {
  path: string;
  id: string;
  moveTo: string;
}): Promise<Result> {
  const p = z.object({ id: uuid, moveTo: uuid }).safeParse(input);
  if (!p.success) return { ok: false, error: "Pick a column for its tasks." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_status", {
    p_status: p.data.id,
    p_move_to: p.data.moveTo,
  });
  if (error)
    return {
      ok: false,
      error: error.message.includes("STATUS_MOVE_INVALID")
        ? "Pick another column in this project."
        : denied,
    };
  revalidatePath(input.path, "layout");
  return { ok: true };
}
