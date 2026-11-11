import type { Metadata } from "next";
import { GeneralForm } from "@/components/settings/forms";
import { SettingsSection } from "@/components/settings/section";
import { ArchivedProjects } from "@/components/settings/archived-projects";
import { createClient } from "@/lib/supabase/server";
import { canManage, getWorkspaceContext } from "@/lib/workspace";

export const metadata: Metadata = { title: "General settings" };

export default async function GeneralSettings({ params }: PageProps<"/w/[slug]/settings/general">) {
  const { slug } = await params;
  const { workspace } = await getWorkspaceContext(slug);
  const supabase = await createClient();
  const { data: archived } = await supabase
    .from("projects")
    .select("id, name, color, archived_at")
    .eq("workspace_id", workspace.id)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false });
  return (
    <>
      <SettingsSection title="General" description="Your workspace's name and address." />
      <GeneralForm
        slug={slug}
        name={workspace.name}
        canEdit={canManage(workspace.role)}
        isDemo={workspace.isDemo}
        isOwner={workspace.role === "owner"}
      />
      <ArchivedProjects
        slug={slug}
        canEdit={canManage(workspace.role)}
        projects={(archived ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          archivedAt: p.archived_at as string,
        }))}
      />
    </>
  );
}
