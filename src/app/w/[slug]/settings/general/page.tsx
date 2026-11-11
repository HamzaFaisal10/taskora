import type { Metadata } from "next";
import { GeneralForm } from "@/components/settings/forms";
import { SettingsSection } from "@/components/settings/section";
import { canManage, getWorkspaceContext } from "@/lib/workspace";

export const metadata: Metadata = { title: "General settings" };

export default async function GeneralSettings({ params }: PageProps<"/w/[slug]/settings/general">) {
  const { slug } = await params;
  const { workspace } = await getWorkspaceContext(slug);
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
    </>
  );
}
