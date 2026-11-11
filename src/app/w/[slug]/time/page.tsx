import { addDays, format, isValid, parseISO, startOfWeek } from "date-fns";
import type { Metadata } from "next";
import { Timesheet, type Entry } from "@/components/time/timesheet";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";

export const metadata: Metadata = { title: "Time" };

export default async function TimePage({ params, searchParams }: PageProps<"/w/[slug]/time">) {
  const [{ slug }, { week }] = await Promise.all([params, searchParams]);
  const { workspace, viewer } = await getWorkspaceContext(slug);
  const picked = typeof week === "string" ? parseISO(week) : new Date();
  const start = startOfWeek(isValid(picked) ? picked : new Date(), { weekStartsOn: 1 });
  const end = addDays(start, 7);

  const supabase = await createClient();
  const { data } = await supabase
    .from("time_entries")
    .select(
      "id, started_at, ended_at, duration_seconds, note, user:profiles!time_entries_user_id_fkey(id, full_name, avatar_url), tasks!inner(number, title, workspace_id, projects!inner(key, name, color))",
    )
    .eq("tasks.workspace_id", workspace.id)
    .gte("started_at", start.toISOString())
    .lt("started_at", end.toISOString())
    .order("started_at")
    .limit(2000);

  type Row = {
    id: string;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number | null;
    note: string;
    user: { id: string; full_name: string; avatar_url: string | null } | null;
    tasks: {
      number: number;
      title: string;
      projects: { key: string; name: string; color: string };
    };
  };
  const entries: Entry[] = ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    startedAt: r.started_at,
    running: !r.ended_at,
    seconds: r.duration_seconds ?? 0,
    note: r.note,
    person: r.user
      ? { id: r.user.id, name: r.user.full_name, avatarUrl: r.user.avatar_url }
      : { id: "former", name: "Former member", avatarUrl: null },
    task: {
      ref: `${r.tasks.projects.key}-${r.tasks.number}`,
      title: r.tasks.title,
      projectKey: r.tasks.projects.key,
      projectName: r.tasks.projects.name,
      projectColor: r.tasks.projects.color,
    },
  }));

  return (
    <Timesheet
      slug={slug}
      weekStart={format(start, "yyyy-MM-dd")}
      entries={entries}
      viewerId={viewer.id}
    />
  );
}
