"use client";

import { format, parseISO } from "date-fns";
import { Check, ExternalLink, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Progress } from "@/components/ui/surface";
import { cancelToFree, openBillingPortal, startCheckout } from "@/lib/billing/actions";
import { money, PLANS, type PlanId } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";
import { SettingsSection } from "./section";

type Invoice = {
  id: string;
  number: string;
  amountCents: number;
  currency: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  isDemo: boolean;
};

function Usage({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const unlimited = limit == null || limit >= 1_000_000;
  const pct = unlimited ? 0 : (used / limit) * 100;
  return (
    <div>
      <div className="flex justify-between text-[13px]">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums">
          {used}
          {unlimited ? "" : ` / ${limit}`}
          {unlimited && <span className="text-subtle"> · unlimited</span>}
        </span>
      </div>
      {!unlimited && (
        <Progress
          value={pct}
          tone={pct >= 100 ? "danger" : pct >= 80 ? "warning" : "accent"}
          className="mt-1.5 h-1.5"
          label={`${label}: ${used} of ${limit}`}
        />
      )}
    </div>
  );
}

export function BillingView({
  slug,
  plan,
  canEdit,
  liveStripe,
  hasCustomer,
  status,
  periodEnd,
  usage,
  invoices,
  checkout,
}: {
  slug: string;
  plan: PlanId;
  canEdit: boolean;
  liveStripe: boolean;
  hasCustomer: boolean;
  status: string | null;
  periodEnd: string | null;
  usage: { projects: number; members: number; aiCredits: number };
  invoices: Invoice[];
  checkout?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null);
  const announced = useRef(false);
  const current = PLANS[plan];

  useEffect(() => {
    if (announced.current || !checkout) return;
    announced.current = true;
    if (checkout === "success") toast.success(`You're on ${current.name}. Thanks for upgrading!`);
    if (checkout === "canceled") toast("Checkout canceled. Nothing was charged.");
    router.replace(`/w/${slug}/settings/billing`, { scroll: false });
  }, [checkout, current.name, router, slug]);

  const choose = (id: PlanId) =>
    start(async () => {
      setBusyPlan(id);
      if (id === "free") {
        const res = liveStripe ? await openBillingPortal({ slug }) : await cancelToFree({ slug });
        setBusyPlan(null);
        if (!res.ok) return void toast.error(res.error);
        if (res.data && "url" in res.data) window.location.href = res.data.url;
        else toast.success("Switched to Free");
        return;
      }
      const res = await startCheckout({ slug, plan: id });
      setBusyPlan(null);
      if (!res.ok) return void toast.error(res.error);
      window.location.href = res.data.url;
    });

  return (
    <div className="space-y-8">
      <section>
        <SettingsSection
          title="Billing"
          description={
            liveStripe
              ? "Payments are handled by Stripe."
              : "Demo mode: upgrades are simulated and nothing is charged."
          }
          actions={
            liveStripe && hasCustomer && canEdit ? (
              <Button
                variant="secondary"
                size="sm"
                loading={pending && busyPlan === null}
                onClick={() =>
                  start(async () => {
                    const res = await openBillingPortal({ slug });
                    if (res.ok) window.location.href = res.data.url;
                    else toast.error(res.error);
                  })
                }
              >
                <ExternalLink /> Manage in Stripe
              </Button>
            ) : undefined
          }
        />
        <Card className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <p className="text-muted text-xs">Current plan</p>
            <p className="mt-1 flex items-center gap-2 text-xl font-semibold">
              {current.name}
              {status && plan !== "free" && (
                <Badge tone={status === "active" ? "success" : "warning"} className="capitalize">
                  {status.replace("_", " ")}
                </Badge>
              )}
            </p>
            <p className="text-muted mt-1 text-sm">
              {plan === "free"
                ? "Free forever for small teams."
                : `${money(current.pricePerSeat * 100 * usage.members)} a month · ${usage.members} seats × ${money(current.pricePerSeat * 100)}`}
            </p>
            {periodEnd && plan !== "free" && (
              <p className="text-subtle mt-1 text-xs">
                Renews {format(parseISO(periodEnd), "MMM d, yyyy")}
              </p>
            )}
          </div>
          <div className="space-y-3">
            <Usage label="Active projects" used={usage.projects} limit={current.limits.projects} />
            <Usage label="Members" used={usage.members} limit={current.limits.members} />
            <Usage
              label="AI credits this month"
              used={usage.aiCredits}
              limit={current.limits.aiCredits}
            />
          </div>
        </Card>
      </section>

      <section aria-labelledby="plans">
        <h2 id="plans" className="mb-3 text-[13px] font-semibold">
          Plans
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {(Object.keys(PLANS) as PlanId[]).map((id) => {
            const p = PLANS[id];
            const isCurrent = id === plan;
            const order = { free: 0, pro: 1, business: 2 };
            return (
              <Card
                key={id}
                className={cn("flex flex-col p-5", isCurrent && "border-accent-border")}
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{p.name}</h3>
                  {id === "pro" && !isCurrent && (
                    <Badge tone="accent">
                      <Sparkles className="size-3" /> Popular
                    </Badge>
                  )}
                  {isCurrent && <Badge tone="accent">Current</Badge>}
                </div>
                <p className="mt-2">
                  <span className="text-2xl font-semibold tabular-nums">
                    {money(p.pricePerSeat * 100)}
                  </span>
                  <span className="text-muted text-sm">
                    {" "}
                    {p.pricePerSeat ? "per member / month" : "forever"}
                  </span>
                </p>
                <p className="text-muted mt-1 text-[13px]">{p.tagline}</p>
                <ul className="mt-4 flex-1 space-y-1.5 text-[13px]">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="text-success-text mt-0.5 size-3.5 shrink-0" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                {canEdit && !isCurrent && (
                  <Button
                    className="mt-5"
                    variant={order[id] > order[plan] ? "primary" : "secondary"}
                    loading={busyPlan === id}
                    disabled={pending}
                    onClick={() => choose(id)}
                  >
                    {order[id] > order[plan] ? `Upgrade to ${p.name}` : `Switch to ${p.name}`}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
        {!canEdit && (
          <p className="text-subtle mt-2 text-xs">Only owners and admins can change the plan.</p>
        )}
      </section>

      <section aria-labelledby="invoices">
        <h2 id="invoices" className="mb-3 text-[13px] font-semibold">
          Invoices
        </h2>
        <Card className="overflow-x-auto p-0">
          {invoices.length === 0 ? (
            <p className="text-subtle p-5 text-sm">No invoices yet.</p>
          ) : (
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-subtle border-border border-b text-left text-xs">
                  <th className="px-5 py-2 font-medium">Invoice</th>
                  <th className="py-2 font-medium">Period</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                  <th className="px-5 py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-border-subtle border-b last:border-0">
                    <td className="px-5 py-2.5 font-mono text-[12px]">
                      {i.number}
                      {i.isDemo && <Badge className="ml-2 font-sans">Demo</Badge>}
                    </td>
                    <td className="text-muted py-2.5">
                      {format(parseISO(i.periodStart), "MMM d")} –{" "}
                      {format(parseISO(i.periodEnd), "MMM d, yyyy")}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {money(i.amountCents, i.currency)}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <Badge
                        tone={
                          i.status === "paid"
                            ? "success"
                            : i.status === "open"
                              ? "warning"
                              : "neutral"
                        }
                        className="capitalize"
                      >
                        {i.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </section>
    </div>
  );
}
