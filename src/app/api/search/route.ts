import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export type TaskHit = {
  ref: string;
  title: string;
  projectKey: string;
  projectName: string;
  done: boolean;
};

/**
 * Task search for the command menu: by title words, or by reference ("MAD-12"). Row level security
 * limits results to tasks the person can see (guests only get shared projects).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const p = z
    .object({ workspace: z.string().uuid(), q: z.string().trim().min(2).max(100) })
    .safeParse({ workspace: url.searchParams.get("workspace"), q: url.searchParams.get("q") });
  if (!p.success) return NextResponse.json({ tasks: [] });

  const supabase = await createClient();
  const ref = p.data.q.match(/^([a-z][a-z0-9]{1,9})-(\d+)$/i);
  let query = supabase
    .from("tasks")
    .select("number, title, projects!inner(key, name, archived_at), task_statuses!inner(category)")
    .eq("workspace_id", p.data.workspace)
    .is("archived_at", null)
    .is("projects.archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(8);
  if (ref) {
    query = query.eq("projects.key", ref[1].toUpperCase()).eq("number", Number(ref[2]));
  } else {
    // Every word must appear somewhere in the title.
    for (const word of p.data.q.split(/\s+/).slice(0, 5)) {
      query = query.ilike("title", `%${word.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
    }
  }
  const { data } = await query;
  type Row = {
    number: number;
    title: string;
    projects: { key: string; name: string };
    task_statuses: { category: string };
  };
  const tasks: TaskHit[] = ((data ?? []) as unknown as Row[]).map((r) => ({
    ref: `${r.projects.key}-${r.number}`,
    title: r.title,
    projectKey: r.projects.key,
    projectName: r.projects.name,
    done: ["completed", "canceled"].includes(r.task_statuses.category),
  }));
  return NextResponse.json({ tasks }, { headers: { "cache-control": "no-store" } });
}
