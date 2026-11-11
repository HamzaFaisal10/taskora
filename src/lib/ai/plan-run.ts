import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { planFromBrief, type AiMode } from "./engine";
import type { PlanPriority } from "./plan";

export type PlannedTask = {
  title: string;
  priority: PlanPriority;
  estimate: number;
  labelIds: string[];
};
export type PlanAnswer = { mode: AiMode; tasks: PlannedTask[]; creditsLeft: number };
type Result = { ok: true; data: PlanAnswer } | { ok: false; error: string };

/** Drafts tasks for a project from a written brief. Costs one AI credit. Nothing is saved yet. */
export async function planTasks(input: unknown): Promise<Result> {
  const p = z
    .object({
      projectId: z.string().uuid(),
      brief: z
        .string()
        .trim()
        .min(20, "Write a sentence or two about the work first.")
        .max(6000, "Keep the brief under 6,000 characters."),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Invalid request." };

  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .select("workspace_id")
    .eq("id", p.data.projectId)
    .single();
  if (error || !project) return { ok: false, error: "Project not found." };

  const { data: labels } = await supabase
    .from("labels")
    .select("id, name")
    .eq("workspace_id", project.workspace_id);
  const labelList = (labels ?? []) as { id: string; name: string }[];

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

  try {
    const { mode, ideas } = await planFromBrief(
      p.data.brief,
      labelList.map((l) => l.name),
    );
    const idOf = new Map(labelList.map((l) => [l.name, l.id]));
    return {
      ok: true,
      data: {
        mode,
        creditsLeft: credits.data as number,
        tasks: ideas.map((i) => ({
          title: i.title,
          priority: i.priority,
          estimate: i.estimate,
          labelIds: i.labels.map((n) => idOf.get(n)).filter((x): x is string => !!x),
        })),
      },
    };
  } catch {
    return { ok: false, error: "The AI service didn't answer. Please try again." };
  }
}
