"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };
const uuid = z.string().uuid();

const denied = (e: { code?: string; message?: string } | null) =>
  e?.code === "42501" || /row-level security/i.test(e?.message ?? "")
    ? "You can't log time on this task."
    : "Something went wrong. Please try again.";

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id };
}

/** Starts a timer on a task, stopping any timer that is already running (one per person). */
export async function startTimer(input: { taskId: string; path?: string }): Promise<Result> {
  if (!uuid.safeParse(input.taskId).success) return { ok: false, error: "Invalid task." };
  const { supabase, userId } = await me();
  if (!userId) return { ok: false, error: "Sign in first." };
  await supabase
    .from("time_entries")
    .update({ ended_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("ended_at", null);
  const { error } = await supabase
    .from("time_entries")
    .insert({ task_id: input.taskId, user_id: userId });
  if (error) return { ok: false, error: denied(error) };
  revalidatePath(input.path ?? "/w", "layout");
  return { ok: true };
}

export async function stopTimer(input: { path?: string } = {}): Promise<Result> {
  const { supabase, userId } = await me();
  if (!userId) return { ok: false, error: "Sign in first." };
  const { error } = await supabase
    .from("time_entries")
    .update({ ended_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("ended_at", null);
  if (error) return { ok: false, error: denied(error) };
  revalidatePath(input.path ?? "/w", "layout");
  return { ok: true };
}

/** Manual entry, e.g. "1h 30m on Tuesday". */
export async function logTime(input: {
  taskId: string;
  minutes: number;
  date: string;
  note: string;
}): Promise<Result> {
  const p = z
    .object({
      taskId: uuid,
      minutes: z
        .number()
        .int()
        .min(1, "Enter how long you worked.")
        .max(24 * 60, "That's more than a day."),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      note: z.string().trim().max(500),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { supabase, userId } = await me();
  if (!userId) return { ok: false, error: "Sign in first." };
  const start = new Date(`${p.data.date}T09:00:00`);
  const end = new Date(start.getTime() + p.data.minutes * 60_000);
  const { error } = await supabase.from("time_entries").insert({
    task_id: p.data.taskId,
    user_id: userId,
    started_at: start.toISOString(),
    ended_at: end.toISOString(),
    duration_seconds: p.data.minutes * 60,
    note: p.data.note,
  });
  if (error) return { ok: false, error: denied(error) };
  return { ok: true };
}

export async function deleteTimeEntry(input: { id: string }): Promise<Result> {
  if (!uuid.safeParse(input.id).success) return { ok: false, error: "Invalid entry." };
  const { supabase } = await me();
  const { error, count } = await supabase
    .from("time_entries")
    .delete({ count: "exact" })
    .eq("id", input.id);
  if (error || !count) return { ok: false, error: "You can only delete your own time." };
  return { ok: true };
}
