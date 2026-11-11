"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };
const health = z.enum(["on_track", "at_risk", "off_track"]);

/** Posts a status update and sets the project's health to match it. */
export async function postProjectUpdate(input: {
  path: string;
  projectId: string;
  health: "on_track" | "at_risk" | "off_track";
  body: string;
}): Promise<Result> {
  const p = z
    .object({
      path: z.string().startsWith("/w/"),
      projectId: z.string().uuid(),
      health,
      body: z.string().trim().min(1, "Write the update first.").max(10000),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Invalid update." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const { error } = await supabase.from("project_updates").insert({
    project_id: p.data.projectId,
    author_id: user.id,
    health: p.data.health,
    body: p.data.body,
  });
  if (error)
    return {
      ok: false,
      error: /row-level security/i.test(error.message)
        ? "You don't have permission to post updates here."
        : "Couldn't post the update. Please try again.",
    };
  await supabase.from("projects").update({ health: p.data.health }).eq("id", p.data.projectId);
  revalidatePath(p.data.path.split("/").slice(0, 3).join("/"), "layout");
  return { ok: true };
}

/** Deletes an update you wrote. */
export async function deleteProjectUpdate(input: { path: string; id: string }): Promise<Result> {
  const p = z
    .object({ path: z.string().startsWith("/w/"), id: z.string().uuid() })
    .safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid update." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const { count, error } = await supabase
    .from("project_updates")
    .delete({ count: "exact" })
    .eq("id", p.data.id)
    .eq("author_id", user.id);
  if (error || !count) return { ok: false, error: "Couldn't delete that update." };
  revalidatePath(p.data.path, "page");
  return { ok: true };
}
