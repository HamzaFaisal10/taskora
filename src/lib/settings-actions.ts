"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";

type Result = { ok: true } | { ok: false; error: string };
const uuid = z.string().uuid();
const TONES = [
  "neutral",
  "accent",
  "info",
  "success",
  "warning",
  "danger",
  "violet",
  "pink",
] as const;

const denied = (e: { code?: string; message?: string } | null) =>
  e?.code === "42501" || /row-level security/i.test(e?.message ?? "")
    ? "You don't have permission to do that."
    : "Something went wrong. Please try again.";

export async function updateWorkspace(input: {
  slug: string;
  name: string;
  newSlug: string;
}): Promise<Result> {
  const p = z
    .object({
      name: z.string().trim().min(1, "Give the workspace a name.").max(80),
      newSlug: z
        .string()
        .trim()
        .toLowerCase()
        .min(2)
        .max(48)
        .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes."),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { workspace } = await getWorkspaceContext(input.slug);
  if (workspace.isDemo && p.data.newSlug !== workspace.slug)
    return { ok: false, error: "The demo workspace keeps its URL." };
  if (
    ["demo", "admin", "api", "app", "auth", "login", "settings", "pricing", "f"].includes(
      p.data.newSlug,
    ) &&
    p.data.newSlug !== workspace.slug
  ) {
    return { ok: false, error: "That workspace URL is reserved." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("workspaces")
    .update({ name: p.data.name, slug: p.data.newSlug })
    .eq("id", workspace.id);
  if (error)
    return {
      ok: false,
      error: error.code === "23505" ? "That workspace URL is already in use." : denied(error),
    };
  revalidatePath("/w", "layout");
  if (p.data.newSlug !== workspace.slug) redirect(`/w/${p.data.newSlug}/settings/general`);
  return { ok: true };
}

export async function deleteWorkspace(input: { slug: string; confirm: string }): Promise<Result> {
  const { workspace } = await getWorkspaceContext(input.slug);
  if (workspace.isDemo) return { ok: false, error: "The demo workspace can't be deleted." };
  if (input.confirm !== workspace.name)
    return { ok: false, error: "Type the workspace name exactly to confirm." };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("workspaces")
    .delete({ count: "exact" })
    .eq("id", workspace.id);
  if (error || !count) return { ok: false, error: "Only the owner can delete the workspace." };
  redirect("/app");
}

export async function saveLabel(input: {
  slug: string;
  id?: string;
  name: string;
  tone: string;
}): Promise<Result> {
  const p = z
    .object({
      id: uuid.optional(),
      name: z.string().trim().min(1, "Name the label.").max(40),
      tone: z.enum(TONES),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { workspace } = await getWorkspaceContext(input.slug);
  const supabase = await createClient();
  const { error } = p.data.id
    ? await supabase
        .from("labels")
        .update({ name: p.data.name, tone: p.data.tone })
        .eq("id", p.data.id)
    : await supabase
        .from("labels")
        .insert({ workspace_id: workspace.id, name: p.data.name, tone: p.data.tone });
  if (error)
    return {
      ok: false,
      error: error.code === "23505" ? "A label with that name already exists." : denied(error),
    };
  revalidatePath(`/w/${input.slug}`, "layout");
  return { ok: true };
}

export async function deleteLabel(input: { slug: string; id: string }): Promise<Result> {
  if (!uuid.safeParse(input.id).success) return { ok: false, error: "Invalid label." };
  const supabase = await createClient();
  const { error } = await supabase.from("labels").delete().eq("id", input.id);
  if (error) return { ok: false, error: denied(error) };
  revalidatePath(`/w/${input.slug}`, "layout");
  return { ok: true };
}

export async function updateProfile(input: { slug: string; fullName: string }): Promise<Result> {
  const p = z
    .object({ fullName: z.string().trim().min(1, "Enter your name.").max(120) })
    .safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { workspace, viewer } = await getWorkspaceContext(input.slug);
  if (workspace.isDemo) return { ok: false, error: "The demo account's name can't be changed." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: p.data.fullName })
    .eq("id", viewer.id);
  if (error) return { ok: false, error: denied(error) };
  revalidatePath("/w", "layout");
  return { ok: true };
}

/** Change the signed-in person's password, after checking their current one. */
export async function changePassword(input: {
  slug: string;
  current: string;
  next: string;
  confirm: string;
}): Promise<Result> {
  const p = z
    .object({
      current: z.string().min(1, "Enter your current password."),
      next: z.string().min(8, "Use at least 8 characters.").max(72, "Use at most 72 characters."),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  if (p.data.next !== input.confirm) return { ok: false, error: "The new passwords don't match." };
  if (p.data.next === p.data.current)
    return { ok: false, error: "Choose a password different from your current one." };
  const { workspace, viewer } = await getWorkspaceContext(input.slug);
  if (workspace.isDemo)
    return { ok: false, error: "The demo account's password can't be changed." };
  const supabase = await createClient();
  const check = await supabase.auth.signInWithPassword({
    email: viewer.email,
    password: p.data.current,
  });
  if (check.error) return { ok: false, error: "Your current password isn't right." };
  const { error } = await supabase.auth.updateUser({ password: p.data.next });
  if (error) {
    return {
      ok: false,
      error: /different|same/i.test(error.message)
        ? "Choose a password different from your current one."
        : /weak|pwned|leaked/i.test(error.message)
          ? "That password is too easy to guess. Try a longer one."
          : "Couldn't change your password. Try again.",
    };
  }
  return { ok: true };
}
