import type { Metadata } from "next";
import { PasswordForm, ProfileForm } from "@/components/settings/forms";
import { SettingsSection } from "@/components/settings/section";
import { getWorkspaceContext } from "@/lib/workspace";

export const metadata: Metadata = { title: "Your profile" };

export default async function ProfileSettings({ params }: PageProps<"/w/[slug]/settings/profile">) {
  const { slug } = await params;
  const { viewer, workspace } = await getWorkspaceContext(slug);
  return (
    <>
      <SettingsSection
        title="Your profile"
        description="How teammates see you across every workspace."
      />
      <ProfileForm slug={slug} name={viewer.name} email={viewer.email} isDemo={workspace.isDemo} />
      {!workspace.isDemo && (
        <div className="mt-6">
          <PasswordForm slug={slug} />
        </div>
      )}
    </>
  );
}
