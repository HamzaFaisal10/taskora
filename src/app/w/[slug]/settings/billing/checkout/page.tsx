import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoCheckout } from "@/components/settings/demo-checkout";
import { PLANS } from "@/lib/billing/plans";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({
  params,
  searchParams,
}: PageProps<"/w/[slug]/settings/billing/checkout">) {
  const [{ slug }, { plan }] = await Promise.all([params, searchParams]);
  if (plan !== "pro" && plan !== "business") notFound();
  const { workspace, viewer } = await getWorkspaceContext(slug);
  const supabase = await createClient();
  const { count } = await supabase
    .from("workspace_members")
    .select("user_id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id)
    .neq("role", "guest");
  const seats = Math.max(1, count ?? 1);
  return (
    <DemoCheckout
      slug={slug}
      plan={plan}
      planName={PLANS[plan].name}
      pricePerSeat={PLANS[plan].pricePerSeat}
      seats={seats}
      email={viewer.email}
      workspaceName={workspace.name}
    />
  );
}
