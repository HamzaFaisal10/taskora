import { redirect } from "next/navigation";

export default async function SettingsIndex({ params }: PageProps<"/w/[slug]/settings">) {
  redirect(`/w/${(await params).slug}/settings/general`);
}
