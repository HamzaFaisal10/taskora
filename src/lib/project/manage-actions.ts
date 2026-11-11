"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");
const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: string): Result<never> => ({ ok: false, error });

function friendly(
  e: { message?: string; code?: string } | null,
  fallback = "Something went wrong. Please try again.",
) {
  if (!e) return fallback;
  if (e.code === "42501" || /row-level security/i.test(e.message ?? ""))
    return "You don't have permission to do that.";
  if (e.code === "23505") return "Something with that name already exists.";
  return fallback;
}

const done = (path: string) => revalidatePath(path, "layout");

/* --------------------------------- Sprints -------------------------------- */

export async function createSprint(input: {
  path: string;
  projectId: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
}): Promise<Result> {
  const p = z
    .object({
      projectId: uuid,
      name: z.string().trim().min(1, "Name the sprint.").max(60),
      goal: z.string().trim().max(500),
      startDate: date,
      endDate: date,
    })
    .refine((v) => v.endDate >= v.startDate, "The sprint must end after it starts.")
    .safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const supabase = await createClient();
  const { error } = await supabase.from("sprints").insert({
    project_id: p.data.projectId,
    name: p.data.name,
    goal: p.data.goal,
    start_date: p.data.startDate,
    end_date: p.data.endDate,
  });
  if (error) return fail(friendly(error));
  done(input.path);
  return ok(null);
}

export async function startSprint(input: { path: string; sprintId: string }): Promise<Result> {
  if (!uuid.safeParse(input.sprintId).success) return fail("Invalid sprint.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("sprints")
    .update({ state: "active" })
    .eq("id", input.sprintId)
    .eq("state", "planned");
  if (error)
    return fail(
      error.code === "23505"
        ? "Finish the active sprint before starting another."
        : friendly(error),
    );
  done(input.path);
  return ok(null);
}

/** Closes a sprint and carries its unfinished tasks to another sprint (or the backlog). */
export async function completeSprint(input: {
  path: string;
  sprintId: string;
  moveTo: string | null;
  unfinishedIds: string[];
}): Promise<Result> {
  const p = z
    .object({ sprintId: uuid, moveTo: uuid.nullable(), unfinishedIds: z.array(uuid).max(500) })
    .safeParse(input);
  if (!p.success) return fail("Invalid sprint.");
  const supabase = await createClient();
  if (p.data.unfinishedIds.length) {
    const { error } = await supabase
      .from("tasks")
      .update({ sprint_id: p.data.moveTo })
      .in("id", p.data.unfinishedIds);
    if (error) return fail(friendly(error));
  }
  const { error } = await supabase
    .from("sprints")
    .update({ state: "completed" })
    .eq("id", p.data.sprintId);
  if (error) return fail(friendly(error));
  done(input.path);
  return ok(null);
}

/* ------------------------------- Automations ------------------------------ */

const condition = z.object({
  field: z.enum(["status_category", "priority", "source", "label_id", "assignee_id"]),
  op: z.enum(["eq", "neq", "in", "not_in"]),
  value: z.union([z.string(), z.array(z.string())]),
});
const category = z.enum([
  "triage",
  "backlog",
  "unstarted",
  "started",
  "review",
  "completed",
  "canceled",
]);
const trigger = z.discriminatedUnion("type", [
  z.object({ type: z.literal("task_created") }),
  z.object({ type: z.literal("status_changed"), to_category: category }),
  z.object({ type: z.literal("label_added") }),
  z.object({ type: z.literal("due_in"), days: z.number().int().min(0).max(30) }),
]);
const action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("assign"), user_id: uuid }),
  z.object({ type: z.literal("notify"), user_id: uuid }),
  z.object({ type: z.literal("notify_assignee") }),
  z.object({
    type: z.literal("set_priority"),
    priority: z.enum(["none", "low", "medium", "high", "urgent"]),
  }),
  z.object({ type: z.literal("move_to_category"), category }),
  z.object({ type: z.literal("add_label"), label_id: uuid }),
  z.object({ type: z.literal("complete_subtasks") }),
  z.object({ type: z.literal("stop_timers") }),
]);

export type AutomationInput = {
  name: string;
  trigger: z.infer<typeof trigger>;
  conditions: z.infer<typeof condition>[];
  actions: z.infer<typeof action>[];
};

export async function createAutomation(
  input: { path: string; projectId: string } & AutomationInput,
): Promise<Result> {
  const p = z
    .object({
      projectId: uuid,
      name: z.string().trim().min(1, "Name the rule.").max(120),
      trigger,
      conditions: z.array(condition).max(5),
      actions: z.array(action).min(1, "Add at least one action.").max(5),
    })
    .safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("automations").insert({
    project_id: p.data.projectId,
    name: p.data.name,
    trigger: p.data.trigger,
    conditions: p.data.conditions,
    actions: p.data.actions,
    created_by: user?.id,
  });
  if (error) return fail(friendly(error));
  done(input.path);
  return ok(null);
}

export async function setAutomationEnabled(input: {
  path: string;
  id: string;
  enabled: boolean;
}): Promise<Result> {
  if (!uuid.safeParse(input.id).success) return fail("Invalid rule.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("automations")
    .update({ enabled: input.enabled })
    .eq("id", input.id);
  if (error) return fail(friendly(error));
  done(input.path);
  return ok(null);
}

export async function deleteAutomation(input: { path: string; id: string }): Promise<Result> {
  if (!uuid.safeParse(input.id).success) return fail("Invalid rule.");
  const supabase = await createClient();
  const { error } = await supabase.from("automations").delete().eq("id", input.id);
  if (error) return fail(friendly(error));
  done(input.path);
  return ok(null);
}

/* ---------------------------------- Forms --------------------------------- */

const field = z.object({
  id: z.string().regex(/^q\d{1,2}$/),
  label: z.string().trim().min(1, "Every question needs a label.").max(120),
  type: z.enum(["short_text", "long_text", "select", "email"]),
  required: z.boolean(),
  maps_to: z.enum(["title", "description", "priority", "requester_email"]),
  options: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
});
export type FormField = z.infer<typeof field>;

export async function createForm(input: {
  path: string;
  projectId: string;
  title: string;
  description: string;
  fields: FormField[];
}): Promise<Result<{ slug: string }>> {
  const p = z
    .object({
      projectId: uuid,
      title: z.string().trim().min(1, "Give the form a title.").max(120),
      description: z.string().trim().max(500),
      fields: z.array(field).min(1).max(12),
    })
    .refine(
      (v) => v.fields.filter((f) => f.maps_to === "title").length === 1,
      "Exactly one question must become the task title.",
    )
    .safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);

  const base =
    p.data.title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "form";
  const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("forms").insert({
    project_id: p.data.projectId,
    slug,
    title: p.data.title,
    description: p.data.description,
    fields: p.data.fields,
    created_by: user?.id,
  });
  if (error) return fail(friendly(error));
  done(input.path);
  return ok({ slug });
}

export async function setFormPublic(input: {
  path: string;
  id: string;
  isPublic: boolean;
}): Promise<Result> {
  if (!uuid.safeParse(input.id).success) return fail("Invalid form.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("forms")
    .update({ is_public: input.isPublic })
    .eq("id", input.id);
  if (error) return fail(friendly(error));
  done(input.path);
  return ok(null);
}

export async function deleteForm(input: { path: string; id: string }): Promise<Result> {
  if (!uuid.safeParse(input.id).success) return fail("Invalid form.");
  const supabase = await createClient();
  const { error } = await supabase.from("forms").delete().eq("id", input.id);
  if (error) return fail(friendly(error));
  done(input.path);
  return ok(null);
}

/** Public submission from /f/[slug]. Runs as the anonymous visitor through the submit_form RPC. */
export async function submitPublicForm(
  slug: string,
  answers: Record<string, string>,
): Promise<Result<{ ref: string }>> {
  const p = z
    .object({ slug: z.string().max(80), answers: z.record(z.string(), z.string().max(5000)) })
    .safeParse({ slug, answers });
  if (!p.success) return fail("Please check your answers.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_form", {
    p_slug: p.data.slug,
    p_answers: p.data.answers,
  });
  if (error) {
    if (error.message.includes("FORM_NOT_FOUND"))
      return fail("This form is no longer accepting answers.");
    if (
      error.message.includes("FORM_FIELD_REQUIRED") ||
      error.message.includes("FORM_EMAIL_INVALID")
    )
      return fail(error.hint ?? "Please check your answers.");
    return fail("We couldn't send your answer. Please try again.");
  }
  return ok({ ref: data as string });
}

/* ---------------------------------- Goals --------------------------------- */

export async function createGoal(input: {
  path: string;
  workspaceId: string;
  title: string;
  description: string;
  period: string;
  dueDate: string | null;
  ownerId: string | null;
  keyResults: { title: string; start: number; target: number; unit: string }[];
}): Promise<Result> {
  const p = z
    .object({
      workspaceId: uuid,
      title: z.string().trim().min(1, "Name the goal.").max(160),
      description: z.string().trim().max(2000),
      period: z.string().trim().max(40),
      dueDate: date.nullable(),
      ownerId: uuid.nullable(),
      keyResults: z
        .array(
          z.object({
            title: z.string().trim().min(1, "Name each key result.").max(160),
            start: z.number().finite(),
            target: z.number().finite(),
            unit: z.string().trim().max(8),
          }),
        )
        .max(6)
        .refine(
          (krs) => krs.every((k) => k.start !== k.target),
          "A key result's target must differ from its start.",
        ),
    })
    .safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const supabase = await createClient();
  const { data: goal, error } = await supabase
    .from("goals")
    .insert({
      workspace_id: p.data.workspaceId,
      title: p.data.title,
      description: p.data.description,
      period: p.data.period,
      due_date: p.data.dueDate,
      owner_id: p.data.ownerId,
    })
    .select("id")
    .single();
  if (error) return fail(friendly(error));
  if (p.data.keyResults.length) {
    const { error: krError } = await supabase.from("key_results").insert(
      p.data.keyResults.map((k, i) => ({
        goal_id: goal.id,
        title: k.title,
        start_value: k.start,
        current_value: k.start,
        target_value: k.target,
        unit: k.unit,
        position: i,
      })),
    );
    if (krError) return fail(friendly(krError));
  }
  done(input.path);
  return ok(null);
}

export async function updateKeyResult(input: {
  path: string;
  id: string;
  current: number;
}): Promise<Result> {
  const p = z.object({ id: uuid, current: z.number().finite() }).safeParse(input);
  if (!p.success) return fail("Enter a number.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("key_results")
    .update({ current_value: p.data.current })
    .eq("id", p.data.id);
  if (error) return fail(friendly(error));
  done(input.path);
  return ok(null);
}

export async function setGoalHealth(input: {
  path: string;
  id: string;
  health: "on_track" | "at_risk" | "off_track";
}): Promise<Result> {
  const p = z
    .object({ id: uuid, health: z.enum(["on_track", "at_risk", "off_track"]) })
    .safeParse(input);
  if (!p.success) return fail("Invalid status.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ health: p.data.health })
    .eq("id", p.data.id);
  if (error) return fail(friendly(error));
  done(input.path);
  return ok(null);
}

export async function deleteGoal(input: { path: string; id: string }): Promise<Result> {
  if (!uuid.safeParse(input.id).success) return fail("Invalid goal.");
  const supabase = await createClient();
  const { error } = await supabase.from("goals").delete().eq("id", input.id);
  if (error) return fail(friendly(error));
  done(input.path);
  return ok(null);
}
