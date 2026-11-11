"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { error?: string; field?: "name" | "slug" } | undefined;

const schema = z.object({
  name: z.string().trim().min(1, "Give your workspace a name.").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Use at least 2 characters.")
    .max(48)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes."),
});

export async function createWorkspace(
  _: OnboardingState,
  form: FormData,
): Promise<OnboardingState> {
  const parsed = schema.safeParse({ name: form.get("name"), slug: form.get("slug") });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue.message, field: issue.path[0] as "name" | "slug" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_workspace", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
  });
  if (error) {
    if (error.message.includes("DEMO_ACCOUNT")) {
      return {
        error: "The demo account can't create workspaces. Sign up for your own free account.",
      };
    }
    if (error.message.includes("SLUG_TAKEN") || error.code === "23505") {
      return { error: "That workspace URL is already in use.", field: "slug" };
    }
    return { error: "Couldn't create the workspace. Please try again." };
  }
  redirect(`/w/${(data as { slug: string }).slug}`);
}
