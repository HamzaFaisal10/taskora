import type { Metadata } from "next";
import { LabelsManager } from "@/components/settings/forms";
import { SettingsSection } from "@/components/settings/section";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";

export const metadata: Metadata = { title: "Labels" };

export default async function LabelsSettings({ params }: PageProps<"/w/[slug]/settings/labels">) {
  const { slug } = await params;
  const { workspace } = await getWorkspaceContext(slug);
  const supabase = await createClient();
  const { data } = await supabase
    .from("labels")
    .select("id, name, tone, task_labels(count)")
    .eq("workspace_id", workspace.id)
    .order("name");
  type Row = { id: string; name: string; tone: string; task_labels: { count: number }[] };
  const rows = (data ?? []) as unknown as Row[];
  return (
    <>
      <SettingsSection title="Labels" description="Shared across every project in the workspace." />
      <LabelsManager
        slug={slug}
        labels={rows.map(({ id, name, tone }) => ({ id, name, tone }))}
        counts={Object.fromEntries(rows.map((r) => [r.id, r.task_labels[0]?.count ?? 0]))}
        canEdit={workspace.role !== "guest"}
      />
    </>
  );
}
