"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markAllRead(slug: string, workspaceId: string) {
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .is("read_at", null);
  revalidatePath(`/w/${slug}`, "layout");
}
