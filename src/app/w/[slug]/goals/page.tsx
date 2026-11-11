import type { Metadata } from "next";
import { GoalsView, type Goal } from "@/components/goals/goals-view";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage({ params }: PageProps<"/w/[slug]/goals">) {
  const { slug } = await params;
  const { workspace, projects } = await getWorkspaceContext(slug);
  const supabase = await createClient();

  const [goals, members] = await Promise.all([
    supabase
      .from("goals")
      .select(
        "id, title, description, period, due_date, health, owner:profiles!goals_owner_id_fkey(id, full_name, avatar_url), key_results(id, title, start_value, current_value, target_value, unit, position), goal_projects(project_id)",
      )
      .eq("workspace_id", workspace.id)
      .order("created_at"),
    supabase
      .from("workspace_members")
      .select("profiles!inner(id, full_name, avatar_url)")
      .eq("workspace_id", workspace.id)
      .neq("role", "guest"),
  ]);

  type Row = {
    id: string;
    title: string;
    description: string;
    period: string;
    due_date: string | null;
    health: Goal["health"];
    owner: { id: string; full_name: string; avatar_url: string | null } | null;
    key_results: {
      id: string;
      title: string;
      start_value: number;
      current_value: number;
      target_value: number;
      unit: string;
      position: number;
    }[];
    goal_projects: { project_id: string }[];
  };
  const list: Goal[] = ((goals.data ?? []) as unknown as Row[]).map((g) => ({
    id: g.id,
    title: g.title,
    description: g.description,
    period: g.period,
    dueDate: g.due_date,
    health: g.health,
    owner: g.owner
      ? { id: g.owner.id, name: g.owner.full_name, avatarUrl: g.owner.avatar_url }
      : null,
    keyResults: [...g.key_results]
      .sort((a, b) => a.position - b.position)
      .map((k) => ({
        id: k.id,
        title: k.title,
        start: Number(k.start_value),
        current: Number(k.current_value),
        target: Number(k.target_value),
        unit: k.unit,
      })),
    projects: g.goal_projects
      .map((gp) => projects.find((p) => p.id === gp.project_id))
      .filter((p) => !!p)
      .map((p) => ({ key: p.key, name: p.name, color: p.color })),
  }));
  type M = { profiles: { id: string; full_name: string; avatar_url: string | null } };
  const people = ((members.data ?? []) as unknown as M[]).map((m) => ({
    id: m.profiles.id,
    name: m.profiles.full_name,
    avatarUrl: m.profiles.avatar_url,
  }));

  return (
    <GoalsView
      goals={list}
      people={people}
      slug={slug}
      workspaceId={workspace.id}
      canEdit={workspace.role !== "guest"}
    />
  );
}
