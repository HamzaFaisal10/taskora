import "server-only";
import { formatISO } from "date-fns";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { writeStatusUpdate, type AiMode } from "./engine";
import type { Health, Snapshot } from "./status-update";

export type UpdateDraft = { mode: AiMode; health: Health; body: string; creditsLeft: number };
type Result = { ok: true; data: UpdateDraft } | { ok: false; error: string };

type Row = {
  id: string;
  number: number;
  title: string;
  priority: Snapshot["tasks"][number]["priority"];
  due_date: string | null;
  completed_at: string | null;
  estimate: number | null;
  sprint_id: string | null;
  task_statuses: { category: string };
};

/** Drafts a status update from the project's tasks and active sprint. Costs one AI credit. */
export async function draftProjectUpdate(input: unknown): Promise<Result> {
  const p = z.object({ projectId: z.string().uuid() }).safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("workspace_id, key")
    .eq("id", p.data.projectId)
    .single();
  if (!project) return { ok: false, error: "Project not found." };

  const [tasks, sprint] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, number, title, priority, due_date, completed_at, estimate, sprint_id, task_statuses!inner(category)",
      )
      .eq("project_id", p.data.projectId)
      .is("archived_at", null)
      .is("parent_id", null),
    supabase
      .from("sprints")
      .select("id, name, start_date, end_date")
      .eq("project_id", p.data.projectId)
      .eq("state", "active")
      .maybeSingle(),
  ]);
  if (tasks.error) return { ok: false, error: "Couldn't read the project's tasks." };
  const ids = (tasks.data ?? []).map((t) => t.id as string);
  const deps = ids.length
    ? await supabase.from("task_dependencies").select("task_id, blocked_by_id").in("task_id", ids)
    : { data: [] };

  const credits = await supabase.rpc("use_ai_credits", {
    p_workspace: project.workspace_id,
    p_amount: 1,
  });
  if (credits.error) {
    return {
      ok: false,
      error: credits.error.message.includes("AI_CREDITS_EXHAUSTED")
        ? "You've used this month's AI credits. Upgrade for more."
        : "You don't have permission to use AI here.",
    };
  }

  const rows = (tasks.data ?? []) as unknown as Row[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const isOpen = (r: Row) => !["completed", "canceled"].includes(r.task_statuses.category);
  const ref = (r: Row) => `${project.key}-${r.number}`;
  const blockersOf = new Map<string, string[]>();
  for (const d of (deps.data ?? []) as { task_id: string; blocked_by_id: string }[]) {
    const blocker = byId.get(d.blocked_by_id);
    if (!byId.has(d.task_id) || !blocker || !isOpen(blocker)) continue;
    blockersOf.set(d.task_id, [...(blockersOf.get(d.task_id) ?? []), ref(blocker)]);
  }
  const s = sprint.data as {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
  } | null;
  const snapshot: Snapshot = {
    today: formatISO(new Date(), { representation: "date" }),
    sprint: s ? { name: s.name, startDate: s.start_date, endDate: s.end_date } : null,
    tasks: rows
      .filter((r) => r.task_statuses.category !== "canceled")
      .map((r) => ({
        ref: ref(r),
        title: r.title,
        open: isOpen(r),
        priority: r.priority,
        dueDate: r.due_date,
        completedAt: r.completed_at,
        estimate: r.estimate,
        inSprint: !!s && r.sprint_id === s.id,
        openBlockers: blockersOf.get(r.id) ?? [],
      })),
  };

  try {
    const draft = await writeStatusUpdate(snapshot);
    return { ok: true, data: { ...draft, creditsLeft: credits.data as number } };
  } catch {
    return { ok: false, error: "The AI service didn't answer. Please try again." };
  }
}
