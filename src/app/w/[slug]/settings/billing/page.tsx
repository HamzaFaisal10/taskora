import type { Metadata } from "next";
import { BillingView } from "@/components/settings/billing-view";
import { stripeEnabled } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";
import { canManage, getWorkspaceContext } from "@/lib/workspace";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingSettings({
  params,
  searchParams,
}: PageProps<"/w/[slug]/settings/billing">) {
  const [{ slug }, { checkout }] = await Promise.all([params, searchParams]);
  const { workspace, projects } = await getWorkspaceContext(slug);
  const supabase = await createClient();
  const [ws, members, invoices] = await Promise.all([
    supabase
      .from("workspaces")
      .select("subscription_status, current_period_end, ai_credits_used, stripe_customer_id")
      .eq("id", workspace.id)
      .single(),
    supabase
      .from("workspace_members")
      .select("user_id", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .neq("role", "guest"),
    supabase
      .from("invoices")
      .select(
        "id, number, amount_cents, currency, status, period_start, period_end, is_demo, created_at",
      )
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(24),
  ]);
  return (
    <BillingView
      slug={slug}
      plan={workspace.plan}
      canEdit={canManage(workspace.role)}
      liveStripe={stripeEnabled() && !workspace.isDemo}
      hasCustomer={Boolean(ws.data?.stripe_customer_id)}
      status={ws.data?.subscription_status ?? null}
      periodEnd={ws.data?.current_period_end ?? null}
      usage={{
        projects: projects.length,
        members: members.count ?? 1,
        aiCredits: ws.data?.ai_credits_used ?? 0,
      }}
      invoices={(invoices.data ?? []).map((i) => ({
        id: i.id,
        number: i.number,
        amountCents: i.amount_cents,
        currency: i.currency,
        status: i.status,
        periodStart: i.period_start,
        periodEnd: i.period_end,
        isDemo: i.is_demo,
      }))}
      checkout={typeof checkout === "string" ? checkout : undefined}
    />
  );
}
