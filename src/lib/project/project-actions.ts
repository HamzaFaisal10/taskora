"use server";

import { addDays, format } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { TEMPLATES } from "./templates";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
const uuid = z.string().uuid();
const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export async function createProject(input: {
  slug: string;
  name: string;
  key: string;
  color: string;
  description: string;
  template: "blank" | "software" | "marketing" | "client";
}): Promise<Result<{ key: string }>> {
  const p = z
    .object({
      name: z.string().trim().min(1, "Name the project.").max(80),
      key: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z][A-Z0-9]{1,5}$/, "Use 2–6 letters or numbers, starting with a letter."),
      color,
      description: z.string().trim().max(2000),
      template: z.enum(["blank", "software", "marketing", "client"]),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };

  const { workspace, viewer } = await getWorkspaceContext(input.slug);
  if (workspace.role === "guest") return { ok: false, error: "Guests can't create projects." };
  const supabase = await createClient();
  // Insert without reading the row back: the visibility policy looks the project up by id, and a new
  // row isn't visible to that lookup inside the same statement. So the id is generated here.
  const project = { id: crypto.randomUUID(), key: p.data.key };
  const { error } = await supabase.from("projects").insert({
    id: project.id,
    workspace_id: workspace.id,
    name: p.data.name,
    key: p.data.key,
    color: p.data.color,
    description: p.data.description,
    created_by: viewer.id,
    lead_id: viewer.id,
  });
  if (error) {
    if (error.message.includes("PLAN_LIMIT_PROJECTS"))
      return {
        ok: false,
        error:
          "The Free plan includes 3 active projects. Archive one or upgrade to Pro in Settings → Billing.",
      };
    if (error.code === "23505")
      return { ok: false, error: `The key ${p.data.key} is already used by another project.` };
    return { ok: false, error: "Couldn't create the project. Please try again." };
  }

  const tasks = TEMPLATES[p.data.template].tasks;
  if (tasks.length) {
    const { data: todo } = await supabase
      .from("task_statuses")
      .select("id")
      .eq("project_id", project.id)
      .eq("category", "unstarted")
      .order("position")
      .limit(1)
      .maybeSingle();
    await supabase.from("tasks").insert(
      tasks.map((t, i) => ({
        project_id: project.id,
        title: t.title,
        priority: t.priority,
        status_id: todo?.id,
        due_date: t.due == null ? null : format(addDays(new Date(), t.due), "yyyy-MM-dd"),
        position: (i + 1) * 1024,
      })),
    );
  }
  await supabase.from("project_favorites").insert({ user_id: viewer.id, project_id: project.id });
  revalidatePath(`/w/${input.slug}`, "layout");
  return { ok: true, data: { key: project.key } };
}

export async function updateProject(input: {
  slug: string;
  projectId: string;
  name: string;
  color: string;
  description: string;
}): Promise<Result> {
  const p = z
    .object({
      projectId: uuid,
      name: z.string().trim().min(1, "Name the project.").max(80),
      color,
      description: z.string().trim().max(2000),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ name: p.data.name, color: p.data.color, description: p.data.description })
    .eq("id", p.data.projectId);
  if (error) return { ok: false, error: "You don't have permission to edit this project." };
  revalidatePath(`/w/${input.slug}`, "layout");
  return { ok: true, data: null };
}

export async function archiveProject(input: { slug: string; projectId: string }): Promise<Result> {
  if (!uuid.safeParse(input.projectId).success) return { ok: false, error: "Invalid project." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", input.projectId);
  if (error)
    return {
      ok: false,
      error: "Only workspace admins and the person who created this project can archive it.",
    };
  revalidatePath(`/w/${input.slug}`, "layout");
  return { ok: true, data: null };
}

export async function setFavorite(input: {
  slug: string;
  projectId: string;
  favorite: boolean;
}): Promise<Result> {
  if (!uuid.safeParse(input.projectId).success) return { ok: false, error: "Invalid project." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const { error } = input.favorite
    ? await supabase
        .from("project_favorites")
        .upsert({ user_id: user.id, project_id: input.projectId })
    : await supabase
        .from("project_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("project_id", input.projectId);
  if (error) return { ok: false, error: "Couldn't update favorites." };
  revalidatePath(`/w/${input.slug}`, "layout");
  return { ok: true, data: null };
}

export async function restoreProject(input: { slug: string; projectId: string }): Promise<Result> {
  if (!uuid.safeParse(input.projectId).success) return { ok: false, error: "Invalid project." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ archived_at: null })
    .eq("id", input.projectId);
  if (error) {
    if (error.message.includes("PLAN_LIMIT_PROJECTS"))
      return {
        ok: false,
        error: "The Free plan includes 3 active projects. Archive another one first.",
      };
    return { ok: false, error: "You don't have permission to restore this project." };
  }
  revalidatePath(`/w/${input.slug}`, "layout");
  return { ok: true, data: null };
}
