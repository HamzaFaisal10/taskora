import { NextResponse } from "next/server";
import { cleanKey, safeError } from "@/lib/env";
import { verifyWebhook } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type StripeEvent = {
  type: string;
  data: {
    object: {
      id: string;
      customer?: string;
      subscription?: string;
      status?: string;
      metadata?: Record<string, string>;
      current_period_end?: number;
      number?: string;
      amount_paid?: number;
      currency?: string;
      period_start?: number;
      period_end?: number;
    };
  };
};

const PLAN_OF_STATUS = (status?: string) =>
  status === "active" || status === "trialing" ? null : "free";
const iso = (s?: number) => (s ? new Date(s * 1000).toISOString() : null);

/** Keeps workspace plans in sync with Stripe. Configure this URL in Stripe → Developers → Webhooks. */
export async function POST(request: Request) {
  const secret = cleanKey(process.env.STRIPE_WEBHOOK_SECRET);
  if (!secret) return NextResponse.json({ error: "Webhooks are not configured." }, { status: 501 });

  const payload = await request.text();
  if (!verifyWebhook(payload, request.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const event = JSON.parse(payload) as StripeEvent;
  const obj = event.data.object;
  const admin = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const workspaceId = obj.metadata?.workspace_id;
        const plan = obj.metadata?.plan;
        if (workspaceId && (plan === "pro" || plan === "business")) {
          await admin
            .from("workspaces")
            .update({
              plan,
              stripe_customer_id: obj.customer,
              stripe_subscription_id: obj.subscription,
              subscription_status: "active",
            })
            .eq("id", workspaceId);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const downgrade =
          event.type === "customer.subscription.deleted" ? "free" : PLAN_OF_STATUS(obj.status);
        const plan = obj.metadata?.plan;
        await admin
          .from("workspaces")
          .update({
            subscription_status:
              event.type === "customer.subscription.deleted" ? "canceled" : obj.status,
            current_period_end: iso(obj.current_period_end),
            ...(downgrade
              ? { plan: downgrade }
              : plan === "pro" || plan === "business"
                ? { plan }
                : {}),
          })
          .eq("stripe_subscription_id", obj.id);
        break;
      }
      case "invoice.paid": {
        const { data: ws } = await admin
          .from("workspaces")
          .select("id")
          .eq("stripe_customer_id", obj.customer)
          .maybeSingle();
        if (ws) {
          await admin.from("invoices").insert({
            workspace_id: ws.id,
            number: obj.number ?? obj.id,
            amount_cents: obj.amount_paid ?? 0,
            currency: obj.currency ?? "usd",
            status: "paid",
            period_start: (iso(obj.period_start) ?? new Date().toISOString()).slice(0, 10),
            period_end: (iso(obj.period_end) ?? new Date().toISOString()).slice(0, 10),
          });
        }
        break;
      }
    }
  } catch (error) {
    console.error("Stripe webhook failed", safeError(error));
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
