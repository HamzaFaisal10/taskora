"use server";

import { addMonths, format, startOfDay } from "date-fns";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PLANS, seatPrice, type BillingInterval } from "./plans";
import { createCheckoutSession, createPortalSession, stripeEnabled } from "./stripe";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
const paidPlan = z.enum(["pro", "business"]);

async function origin() {
  const h = await headers();
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`
  );
}

/** Only owners and admins may change billing. Plan columns can only be written with the service role. */
async function authorize(slug: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("workspace_members")
    .select("role, workspaces!inner(id, slug, plan, is_demo, stripe_customer_id)")
    .eq("user_id", user.id)
    .eq("workspaces.slug", slug)
    .maybeSingle();
  type Row = {
    role: string;
    workspaces: {
      id: string;
      slug: string;
      plan: string;
      is_demo: boolean;
      stripe_customer_id: string | null;
    };
  };
  const row = data as unknown as Row | null;
  if (!row || (row.role !== "owner" && row.role !== "admin")) return null;
  const { count } = await supabase
    .from("workspace_members")
    .select("user_id", { count: "exact", head: true })
    .eq("workspace_id", row.workspaces.id)
    .neq("role", "guest");
  return { user, workspace: row.workspaces, seats: Math.max(1, count ?? 1) };
}

/** Starts an upgrade: real Stripe Checkout (test mode) when configured, otherwise the demo checkout page. */
export async function startCheckout(input: {
  slug: string;
  plan: "pro" | "business";
  interval?: BillingInterval;
}): Promise<Result<{ url: string }>> {
  const plan = paidPlan.safeParse(input.plan);
  const interval: BillingInterval = input.interval === "year" ? "year" : "month";
  if (!plan.success) return { ok: false, error: "Unknown plan." };
  const ctx = await authorize(input.slug);
  if (!ctx) return { ok: false, error: "Only owners and admins can change the plan." };

  const base = `${await origin()}/w/${input.slug}/settings/billing`;
  if (!stripeEnabled() || ctx.workspace.is_demo)
    return { ok: true, data: { url: `${base}/checkout?plan=${plan.data}&interval=${interval}` } };

  try {
    const session = await createCheckoutSession({
      workspaceId: ctx.workspace.id,
      plan: plan.data,
      planName: PLANS[plan.data].name,
      unitAmountCents: seatPrice(plan.data, interval) * 100,
      interval,
      seats: ctx.seats,
      customerId: ctx.workspace.stripe_customer_id,
      email: ctx.user.email ?? "",
      successUrl: `${base}?checkout=success`,
      cancelUrl: `${base}?checkout=canceled`,
    });
    return { ok: true, data: { url: session.url } };
  } catch {
    return { ok: false, error: "Couldn't start checkout. Please try again." };
  }
}

/** Demo checkout: no card is collected and nothing is charged. Switches the plan and records a demo invoice. */
export async function confirmDemoPayment(input: {
  slug: string;
  plan: "pro" | "business";
  interval?: BillingInterval;
}): Promise<Result> {
  const plan = paidPlan.safeParse(input.plan);
  const interval: BillingInterval = input.interval === "year" ? "year" : "month";
  if (!plan.success) return { ok: false, error: "Unknown plan." };
  const ctx = await authorize(input.slug);
  if (!ctx) return { ok: false, error: "Only owners and admins can change the plan." };
  if (stripeEnabled() && !ctx.workspace.is_demo)
    return { ok: false, error: "Payments are live. Use the Stripe checkout." };

  const admin = createAdminClient();
  const now = new Date();
  const periodEnd = addMonths(startOfDay(now), interval === "year" ? 12 : 1);
  const { error } = await admin
    .from("workspaces")
    .update({
      plan: plan.data,
      subscription_status: "active",
      current_period_end: periodEnd.toISOString(),
      billing_interval: interval,
    })
    .eq("id", ctx.workspace.id);
  if (error) return { ok: false, error: "Couldn't update the plan." };

  const { count } = await admin
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", ctx.workspace.id);
  await admin.from("invoices").insert({
    workspace_id: ctx.workspace.id,
    number: `TSK-${format(now, "yyyy")}-${String((count ?? 0) + 1).padStart(4, "0")}`,
    amount_cents: seatPrice(plan.data, interval) * 100 * ctx.seats,
    status: "paid",
    period_start: format(now, "yyyy-MM-dd"),
    period_end: format(periodEnd, "yyyy-MM-dd"),
    is_demo: true,
  });
  revalidatePath(`/w/${input.slug}`, "layout");
  return { ok: true, data: null };
}

/** Back to Free. With Stripe live this happens through the customer portal instead. */
export async function cancelToFree(input: { slug: string }): Promise<Result> {
  const ctx = await authorize(input.slug);
  if (!ctx) return { ok: false, error: "Only owners and admins can change the plan." };
  if (stripeEnabled() && !ctx.workspace.is_demo)
    return { ok: false, error: "Manage your subscription in the billing portal." };
  const { error } = await createAdminClient()
    .from("workspaces")
    .update({
      plan: "free",
      subscription_status: "canceled",
      current_period_end: null,
      billing_interval: "month",
    })
    .eq("id", ctx.workspace.id);
  if (error) return { ok: false, error: "Couldn't change the plan." };
  revalidatePath(`/w/${input.slug}`, "layout");
  return { ok: true, data: null };
}

export async function openBillingPortal(input: { slug: string }): Promise<Result<{ url: string }>> {
  const ctx = await authorize(input.slug);
  if (!ctx?.workspace.stripe_customer_id || !stripeEnabled())
    return { ok: false, error: "No Stripe customer for this workspace yet." };
  try {
    const portal = await createPortalSession(
      ctx.workspace.stripe_customer_id,
      `${await origin()}/w/${input.slug}/settings/billing`,
    );
    return { ok: true, data: { url: portal.url } };
  } catch {
    return { ok: false, error: "Couldn't open the billing portal." };
  }
}
