"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
const uuid = z.string().uuid();
const fail = (error: string): Result<never> => ({ ok: false, error });
const message = (e: { message?: string; code?: string } | null) =>
  e?.code === "42501" || /row-level security/i.test(e?.message ?? "")
    ? "You don't have permission to change this."
    : /Invalid value/i.test(e?.message ?? "")
      ? "That value doesn't fit this field."
      : "Something went wrong. Please try again.";

const fieldSchema = z.object({
  projectId: uuid,
  id: uuid.optional(),
  name: z
    .string()
    .trim()
    .min(1, "Give the field a name.")
    .max(40, "Keep the name under 40 characters."),
  kind: z.enum(["text", "number", "date", "select", "checkbox", "person"]),
  options: z.array(z.string().trim().min(1).max(40)).max(30),
});

/** Creates or edits a project's custom field. */
export async function saveField(input: z.input<typeof fieldSchema>): Promise<Result<string>> {
  const p = fieldSchema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0].message);
  const options = [...new Set(p.data.options)];
  if (p.data.kind === "select" && options.length === 0)
    return fail("Add at least one option to choose from.");
  const supabase = await createClient();

  if (p.data.id) {
    const { error } = await supabase
      .from("custom_fields")
      .update({ name: p.data.name, options: p.data.kind === "select" ? options : [] })
      .eq("id", p.data.id);
    if (error) return fail(message(error));
    return { ok: true, data: p.data.id };
  }

  const { data: last } = await supabase
    .from("custom_fields")
    .select("position")
    .eq("project_id", p.data.projectId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const id = crypto.randomUUID();
  const { error } = await supabase.from("custom_fields").insert({
    id,
    project_id: p.data.projectId,
    name: p.data.name,
    kind: p.data.kind,
    options: p.data.kind === "select" ? options : [],
    position: (last?.position ?? -1) + 1,
  });
  if (error) return fail(message(error));
  return { ok: true, data: id };
}

export async function deleteField(input: { id: string }): Promise<Result> {
  const id = uuid.safeParse(input.id);
  if (!id.success) return fail("Invalid field.");
  const supabase = await createClient();
  const { error } = await supabase.from("custom_fields").delete().eq("id", id.data);
  if (error) return fail(message(error));
  return { ok: true, data: null };
}

/** Sets one field on one task; `null` clears it. */
export async function setFieldValue(input: {
  taskId: string;
  fieldId: string;
  value: string | number | boolean | null;
}): Promise<Result> {
  const p = z
    .object({
      taskId: uuid,
      fieldId: uuid,
      value: z.union([z.string().max(500), z.number().finite(), z.boolean()]).nullable(),
    })
    .safeParse(input);
  if (!p.success) return fail("Invalid value.");
  const supabase = await createClient();
  const empty = p.data.value === null || p.data.value === "";
  const { error } = empty
    ? await supabase
        .from("task_field_values")
        .delete()
        .eq("task_id", p.data.taskId)
        .eq("field_id", p.data.fieldId)
    : await supabase
        .from("task_field_values")
        .upsert(
          { task_id: p.data.taskId, field_id: p.data.fieldId, value: p.data.value },
          { onConflict: "task_id,field_id" },
        );
  if (error) return fail(message(error));
  return { ok: true, data: null };
}

/** Makes a task repeat (or stop repeating). Finishing it creates the next one. */
export async function setRecurrence(input: {
  taskId: string;
  recurrence: { freq: "daily" | "weekdays" | "weekly" | "monthly"; interval: number } | null;
}): Promise<Result> {
  const p = z
    .object({
      taskId: uuid,
      recurrence: z
        .object({
          freq: z.enum(["daily", "weekdays", "weekly", "monthly"]),
          interval: z.number().int().min(1).max(12),
        })
        .nullable(),
    })
    .safeParse(input);
  if (!p.success) return fail("Invalid repeat setting.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ recurrence: p.data.recurrence })
    .eq("id", p.data.taskId);
  if (error) return fail(message(error));
  return { ok: true, data: null };
}
