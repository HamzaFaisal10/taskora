import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "admin" | "member" | "guest";

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "pro" | "business";
  isDemo: boolean;
  role: Role;
};
export type ProjectSummary = {
  id: string;
  key: string;
  name: string;
  color: string;
  health: "on_track" | "at_risk" | "off_track";
  favorite: boolean;
};
export type Viewer = { id: string; name: string; email: string; avatarUrl: string | null };

/** The signed-in user, or a redirect to /login. Cached per request. */
export const requireViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  return {
    id: user.id,
    email: user.email ?? "",
    name: profile?.full_name || user.email?.split("@")[0] || "You",
    avatarUrl: profile?.avatar_url ?? null,
  };
});

/** Every workspace the user belongs to, oldest first. */
export const listWorkspaces = cache(async (): Promise<WorkspaceSummary[]> => {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces!inner(id, name, slug, plan, is_demo, created_at)")
    .eq("user_id", viewer.id);
  if (error) throw error;
  type Row = {
    role: Role;
    workspaces: {
      id: string;
      name: string;
      slug: string;
      plan: WorkspaceSummary["plan"];
      is_demo: boolean;
      created_at: string;
    };
  };
  return ((data ?? []) as unknown as Row[])
    .sort((a, b) => a.workspaces.created_at.localeCompare(b.workspaces.created_at))
    .map(({ role, workspaces: w }) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      plan: w.plan,
      isDemo: w.is_demo,
      role,
    }));
});

/** Workspace + sidebar data for /w/[slug]. 404s when the user isn't a member. */
export const getWorkspaceContext = cache(async (slug: string) => {
  const [viewer, workspaces] = await Promise.all([requireViewer(), listWorkspaces()]);
  const workspace = workspaces.find((w) => w.slug === slug);
  if (!workspace) notFound();

  const supabase = await createClient();
  const [projects, favorites, unread, running] = await Promise.all([
    supabase
      .from("projects")
      .select("id, key, name, color, health")
      .eq("workspace_id", workspace.id)
      .is("archived_at", null)
      .order("created_at"),
    supabase.from("project_favorites").select("project_id").eq("user_id", viewer.id),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .eq("user_id", viewer.id)
      .is("read_at", null),
    supabase
      .from("time_entries")
      .select("started_at, tasks!inner(number, title, workspace_id, projects!inner(key))")
      .eq("user_id", viewer.id)
      .eq("tasks.workspace_id", workspace.id)
      .is("ended_at", null)
      .maybeSingle(),
  ]);
  type Running = {
    started_at: string;
    tasks: { number: number; title: string; projects: { key: string } };
  };
  const r = running.data as unknown as Running | null;
  const favs = new Set((favorites.data ?? []).map((f) => f.project_id as string));
  return {
    viewer,
    workspace,
    workspaces,
    unreadCount: unread.count ?? 0,
    runningTimer: r
      ? {
          startedAt: r.started_at,
          ref: `${r.tasks.projects.key}-${r.tasks.number}`,
          projectKey: r.tasks.projects.key,
          title: r.tasks.title,
        }
      : null,
    projects: (projects.data ?? []).map((p) => ({
      ...p,
      favorite: favs.has(p.id),
    })) as ProjectSummary[],
  };
});

export const LAST_WORKSPACE_COOKIE = "taskora-ws";

export const canManage = (role: Role) => role === "owner" || role === "admin";
