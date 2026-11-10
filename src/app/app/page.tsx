import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LAST_WORKSPACE_COOKIE, listWorkspaces } from "@/lib/workspace";

/** Sends the user to their last workspace, their first one, or onboarding. */
export default async function AppEntry() {
  const workspaces = await listWorkspaces();
  if (workspaces.length === 0) redirect("/onboarding");
  const last = (await cookies()).get(LAST_WORKSPACE_COOKIE)?.value;
  const target =
    workspaces.find((w) => w.slug === last) ?? workspaces.find((w) => !w.isDemo) ?? workspaces[0];
  redirect(`/w/${target.slug}`);
}
