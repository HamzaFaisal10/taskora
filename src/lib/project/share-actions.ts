"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
const uuid = z.string().uuid();

export type Person = { id: string; name: string; email: string };
export type ProjectAccess = {
  /** Guests who can see this project. */
  guests: Person[];
  /** Guests in the workspace who can't see it yet. */
  otherGuests: Person[];
  /** Invites waiting to be accepted that include this project. */
  pending: { id: string; email: string; token: string }[];
  members: number;
};

async function projectWorkspace(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("workspace_id, name, workspaces!inner(slug, is_demo)")
    .eq("id", projectId)
    .single();
  return {
    supabase,
    project: data as {
      workspace_id: string;
      name: string;
      workspaces: { slug: string; is_demo: boolean };
    } | null,
  };
}

/** Who can see a project: every member, plus the guests it's shared with. */
export async function getProjectAccess(projectId: string): Promise<Result<ProjectAccess>> {
  if (!uuid.safeParse(projectId).success) return { ok: false, error: "Invalid project." };
  const { supabase, project } = await projectWorkspace(projectId);
  if (!project) return { ok: false, error: "Project not found." };
  const [members, shared, invites] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("user_id, role, profiles!inner(full_name, email)")
      .eq("workspace_id", project.workspace_id),
    supabase.from("project_guests").select("user_id").eq("project_id", projectId),
    supabase
      .from("workspace_invites")
      .select("id, email, token, project_ids")
      .eq("workspace_id", project.workspace_id)
      .eq("role", "guest")
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString()),
  ]);
  if (members.error) return { ok: false, error: "Only owners and admins can share projects." };
  type M = { user_id: string; role: string; profiles: { full_name: string; email: string } };
  const rows = (members.data ?? []) as unknown as M[];
  const sharedIds = new Set((shared.data ?? []).map((r) => r.user_id as string));
  const person = (m: M): Person => ({
    id: m.user_id,
    name: m.profiles.full_name || m.profiles.email.split("@")[0],
    email: m.profiles.email,
  });
  const guests = rows.filter((m) => m.role === "guest");
  return {
    ok: true,
    data: {
      guests: guests.filter((m) => sharedIds.has(m.user_id)).map(person),
      otherGuests: guests.filter((m) => !sharedIds.has(m.user_id)).map(person),
      pending: (
        (invites.data ?? []) as {
          id: string;
          email: string;
          token: string;
          project_ids: string[];
        }[]
      )
        .filter((i) => i.project_ids.includes(projectId))
        .map(({ id, email, token }) => ({ id, email, token })),
      members: rows.filter((m) => m.role !== "guest").length,
    },
  };
}

function done(slug: string) {
  revalidatePath(`/w/${slug}`, "layout");
}

export async function shareWithGuest(input: {
  projectId: string;
  userId: string;
}): Promise<Result> {
  const p = z.object({ projectId: uuid, userId: uuid }).safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid guest." };
  const { supabase, project } = await projectWorkspace(p.data.projectId);
  if (!project) return { ok: false, error: "Project not found." };
  const { error } = await supabase
    .from("project_guests")
    .insert({ project_id: p.data.projectId, user_id: p.data.userId });
  if (error && error.code !== "23505")
    return { ok: false, error: "Only owners and admins can share projects." };
  done(project.workspaces.slug);
  return { ok: true, data: null };
}

export async function unshareWithGuest(input: {
  projectId: string;
  userId: string;
}): Promise<Result> {
  const p = z.object({ projectId: uuid, userId: uuid }).safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid guest." };
  const { supabase, project } = await projectWorkspace(p.data.projectId);
  if (!project) return { ok: false, error: "Project not found." };
  const { error } = await supabase
    .from("project_guests")
    .delete()
    .eq("project_id", p.data.projectId)
    .eq("user_id", p.data.userId);
  if (error) return { ok: false, error: "Only owners and admins can change sharing." };
  done(project.workspaces.slug);
  return { ok: true, data: null };
}

/**
 * Shares a project with someone by email. An existing guest gets access straight away; anyone new
 * gets a guest invite link that adds them to this project when they accept it.
 */
export async function inviteGuestToProject(input: {
  projectId: string;
  email: string;
}): Promise<Result<{ kind: "shared" | "invited"; token?: string }>> {
  const p = z
    .object({
      projectId: uuid,
      email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Invalid email." };
  const { supabase, project } = await projectWorkspace(p.data.projectId);
  if (!project) return { ok: false, error: "Project not found." };
  if (project.workspaces.is_demo)
    return { ok: false, error: "Invites are turned off in the demo workspace." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const { data: existing } = await supabase
    .from("workspace_members")
    .select("user_id, role, profiles!inner(email)")
    .eq("workspace_id", project.workspace_id)
    .eq("profiles.email", p.data.email)
    .maybeSingle();
  if (existing) {
    if (existing.role !== "guest")
      return { ok: false, error: "They're already a member, so they can see every project." };
    const shared = await shareWithGuest({
      projectId: p.data.projectId,
      userId: existing.user_id as string,
    });
    return shared.ok ? { ok: true, data: { kind: "shared" } } : shared;
  }

  const { data: open } = await supabase
    .from("workspace_invites")
    .select("id, role, token, project_ids")
    .eq("workspace_id", project.workspace_id)
    .eq("email", p.data.email)
    .is("accepted_at", null)
    .maybeSingle();
  if (open) {
    if (open.role !== "guest")
      return {
        ok: false,
        error: "They already have a member invite, which includes every project.",
      };
    const ids = Array.from(new Set([...(open.project_ids as string[]), p.data.projectId]));
    const { error } = await supabase
      .from("workspace_invites")
      .update({ project_ids: ids, expires_at: new Date(Date.now() + 7 * 864e5).toISOString() })
      .eq("id", open.id);
    if (error) return { ok: false, error: "Only owners and admins can invite guests." };
    done(project.workspaces.slug);
    return { ok: true, data: { kind: "invited", token: open.token as string } };
  }

  const { data, error } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: project.workspace_id,
      email: p.data.email,
      role: "guest",
      invited_by: user.id,
      project_ids: [p.data.projectId],
    })
    .select("token")
    .single();
  if (error) return { ok: false, error: "Only owners and admins can invite guests." };
  done(project.workspaces.slug);
  return { ok: true, data: { kind: "invited", token: data.token as string } };
}
