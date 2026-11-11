import { AutomationsView, type Automation } from "@/components/project/automations-view";
import { getProjectData } from "@/lib/project/data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Automations" };

export default async function AutomationsPage({
  params,
}: PageProps<"/w/[slug]/p/[key]/automations">) {
  const { slug, key } = await params;
  const { project } = await getProjectData(slug, key);
  const supabase = await createClient();
  const { data } = await supabase
    .from("automations")
    .select("id, name, trigger, conditions, actions, enabled, run_count, last_run_at")
    .eq("project_id", project.id)
    .order("created_at");
  type Row = {
    id: string;
    name: string;
    trigger: Automation["trigger"];
    conditions: Automation["conditions"];
    actions: Automation["actions"];
    enabled: boolean;
    run_count: number;
    last_run_at: string | null;
  };
  const rules: Automation[] = ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    name: r.name,
    trigger: r.trigger,
    conditions: r.conditions,
    actions: r.actions,
    enabled: r.enabled,
    runCount: r.run_count,
    lastRunAt: r.last_run_at,
  }));
  return <AutomationsView rules={rules} />;
}
