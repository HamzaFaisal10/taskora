"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };
const uuid = z.string().uuid();

/** Records a file that the browser already uploaded to Storage under <task id>/… */
export async function addAttachment(input: {
  taskId: string;
  path: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
}): Promise<Result> {
  const p = z
    .object({
      taskId: uuid,
      path: z.string().min(40).max(400),
      fileName: z.string().trim().min(1).max(255),
      sizeBytes: z
        .number()
        .int()
        .min(0)
        .max(25 * 1024 * 1024),
      mimeType: z.string().max(120),
    })
    .safeParse(input);
  if (!p.success || !p.data.path.startsWith(`${p.data.taskId}/`))
    return { ok: false, error: "Invalid file." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("attachments").insert({
    task_id: p.data.taskId,
    uploaded_by: user?.id,
    file_name: p.data.fileName,
    storage_path: p.data.path,
    size_bytes: p.data.sizeBytes,
    mime_type: p.data.mimeType || "application/octet-stream",
  });
  if (error) {
    await supabase.storage.from("attachments").remove([p.data.path]);
    return { ok: false, error: "You can't add files to this task." };
  }
  return { ok: true };
}

export async function deleteAttachment(input: { id: string }): Promise<Result> {
  if (!uuid.safeParse(input.id).success) return { ok: false, error: "Invalid file." };
  const supabase = await createClient();
  const { data } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("id", input.id)
    .maybeSingle();
  if (!data) return { ok: false, error: "File not found." };
  const { error, count } = await supabase
    .from("attachments")
    .delete({ count: "exact" })
    .eq("id", input.id);
  if (error || !count) return { ok: false, error: "You can't delete this file." };
  await supabase.storage.from("attachments").remove([data.storage_path]);
  return { ok: true };
}
