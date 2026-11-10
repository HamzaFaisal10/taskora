"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";

export type InviteState = { error?: string; link?: string; email?: string } | undefined;

const invite = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(["admin", "member", "guest"]),
});

export async function createInvite(
  slug: string,
  _: InviteState,
  form: FormData,
): Promise<InviteState> {
  const { workspace, viewer } = await getWorkspaceContext(slug);
  if (workspace.isDemo) return { error: "Invites are turned off in the demo workspace." };
  const parsed = invite.safeParse({ email: form.get("email"), role: form.get("role") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: workspace.id,
      email: parsed.data.email,
      role: parsed.data.role,
      invited_by: viewer.id,
    })
    .select("token")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "That person already has a pending invite." };
    if (error.message.includes("PLAN_LIMIT"))
      return { error: "Your plan's member limit is reached. Upgrade to invite more people." };
    return { error: "Couldn't create the invite. Only owners and admins can invite people." };
  }
  revalidatePath(`/w/${slug}/settings/members`);
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return { link: `${origin}/invite/${data.token}`, email: parsed.data.email };
}

export async function changeRole(slug: string, userId: string, role: "admin" | "member" | "guest") {
  const { workspace } = await getWorkspaceContext(slug);
  const supabase = await createClient();
  await supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspace.id)
    .eq("user_id", userId);
  revalidatePath(`/w/${slug}/settings/members`);
}

export async function removeMember(slug: string, userId: string) {
  const { workspace } = await getWorkspaceContext(slug);
  const supabase = await createClient();
  await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspace.id)
    .eq("user_id", userId);
  revalidatePath(`/w/${slug}/settings/members`);
}

export async function revokeInvite(slug: string, inviteId: string) {
  const supabase = await createClient();
  await supabase.from("workspace_invites").delete().eq("id", inviteId);
  revalidatePath(`/w/${slug}/settings/members`);
}
