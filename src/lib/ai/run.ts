import "server-only";
import { z } from "zod";
import { loadTaskDetail } from "@/lib/project/task-detail";
import { createClient } from "@/lib/supabase/server";
import {
  breakdownTask,
  draftDescription,
  summarizeTask,
  type AiMode,
  type SubtaskIdea,
  type TaskContext,
} from "./engine";

export type AiKind = "breakdown" | "summary" | "description";
export type AiAnswer =
  | { kind: "breakdown"; mode: AiMode; subtasks: SubtaskIdea[]; creditsLeft: number }
  | { kind: "summary"; mode: AiMode; lines: string[]; creditsLeft: number }
  | { kind: "description"; mode: AiMode; description: string; creditsLeft: number };

type Result = { ok: true; data: AiAnswer } | { ok: false; error: string };

export async function askAi(input: {
  kind: AiKind;
  projectId: string;
  number: number;
}): Promise<Result> {
  const p = z
    .object({
      kind: z.enum(["breakdown", "summary", "description"]),
      projectId: z.string().uuid(),
      number: z.number().int().positive(),
    })
    .safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid request." };

  const detail = await loadTaskDetail(p.data.projectId, p.data.number);
  if (!detail.ok) return detail;
  const task = detail.data;

  const supabase = await createClient();
  const [project, labels, statuses, people] = await Promise.all([
    supabase.from("projects").select("workspace_id").eq("id", p.data.projectId).single(),
    task.labelIds.length
      ? supabase.from("labels").select("name").in("id", task.labelIds)
      : Promise.resolve({ data: [] }),
    supabase.from("task_statuses").select("id, name, category").eq("project_id", p.data.projectId),
    task.assigneeId
      ? supabase.from("profiles").select("full_name").eq("id", task.assigneeId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (project.error) return { ok: false, error: "Project not found." };

  // One credit per request; the database refuses when the month's credits are used up.
  const credits = await supabase.rpc("use_ai_credits", {
    p_workspace: project.data.workspace_id,
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

  const statusList = (statuses.data ?? []) as { id: string; name: string; category: string }[];
  const statusOf = (id: string) => statusList.find((s) => s.id === id);
  const ctx: TaskContext = {
    title: task.title,
    description: task.description,
    labels: ((labels.data ?? []) as { name: string }[]).map((l) => l.name),
    status: statusOf(task.statusId)?.name ?? "Open",
    assignee: (people.data as { full_name: string } | null)?.full_name ?? null,
    dueDate: task.dueDate,
    subtasks: task.children.map((c) => ({
      title: c.title,
      done: ["completed", "canceled"].includes(statusOf(c.statusId)?.category ?? ""),
    })),
    blockers: task.blockedBy.map((b) => ({ ref: b.ref, title: b.title, done: b.done })),
    comments: task.commentList.map((c) => ({ author: c.author?.name ?? "Someone", body: c.body })),
  };
  const creditsLeft = credits.data as number;

  try {
    if (p.data.kind === "breakdown")
      return { ok: true, data: { kind: "breakdown", ...(await breakdownTask(ctx)), creditsLeft } };
    if (p.data.kind === "summary")
      return { ok: true, data: { kind: "summary", ...(await summarizeTask(ctx)), creditsLeft } };
    return {
      ok: true,
      data: { kind: "description", ...(await draftDescription(ctx)), creditsLeft },
    };
  } catch {
    return { ok: false, error: "The AI service didn't answer. Please try again." };
  }
}
