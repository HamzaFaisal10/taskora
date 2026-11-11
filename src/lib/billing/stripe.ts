import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cleanKey } from "@/lib/env";

/**
 * A small Stripe client over the REST API (no SDK needed for the three calls we make).
 * Billing runs in demo mode until STRIPE_SECRET_KEY is set; use a test-mode key (sk_test_…).
 */
export const stripeKey = () => cleanKey(process.env.STRIPE_SECRET_KEY);
export const stripeEnabled = () => Boolean(stripeKey());

function form(data: Record<string, string | number | undefined>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(data)) if (v !== undefined) body.append(k, String(v));
  return body;
}

async function stripe<T>(
  path: string,
  data: Record<string, string | number | undefined>,
): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${stripeKey()}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form(data),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok) throw new Error(json.error?.message ?? `Stripe request failed (${res.status})`);
  return json;
}

/** Hosted Stripe Checkout for a per-seat subscription. */
export function createCheckoutSession(input: {
  workspaceId: string;
  plan: "pro" | "business";
  planName: string;
  unitAmountCents: number;
  seats: number;
  customerId: string | null;
  email: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return stripe<{ id: string; url: string }>("checkout/sessions", {
    mode: "subscription",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    customer: input.customerId ?? undefined,
    customer_email: input.customerId ? undefined : input.email,
    client_reference_id: input.workspaceId,
    "metadata[workspace_id]": input.workspaceId,
    "metadata[plan]": input.plan,
    "subscription_data[metadata][workspace_id]": input.workspaceId,
    "subscription_data[metadata][plan]": input.plan,
    "line_items[0][quantity]": input.seats,
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": input.unitAmountCents,
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][price_data][product_data][name]": `Taskora ${input.planName}`,
  });
}

export function createPortalSession(customerId: string, returnUrl: string) {
  return stripe<{ url: string }>("billing_portal/sessions", {
    customer: customerId,
    return_url: returnUrl,
  });
}

/** Verifies the Stripe-Signature header (HMAC-SHA256 of "timestamp.payload"), allowing 5 minutes of skew. */
export function verifyWebhook(
  payload: string,
  header: string | null,
  secret: string,
  now = Date.now(),
) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  const signatures = header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  if (!t || signatures.length === 0 || Math.abs(now / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return signatures.some(
    (s) => s.length === expected.length && timingSafeEqual(Buffer.from(s), Buffer.from(expected)),
  );
}
