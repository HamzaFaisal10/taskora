"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { IntervalToggle } from "@/components/billing/interval-toggle";
import { Button } from "@/components/ui/button";
import {
  monthlyEquivalentCents,
  money,
  PLANS,
  seatPrice,
  type BillingInterval,
  type PlanId,
} from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

export function PricingPlans() {
  const [interval, setInterval] = useState<BillingInterval>("month");
  return (
    <div>
      <IntervalToggle value={interval} onChange={setInterval} className="mb-6" />
      <div className="grid gap-4 lg:grid-cols-3">
        {(Object.keys(PLANS) as PlanId[]).map((id) => {
          const p = PLANS[id];
          const featured = id === "pro";
          return (
            <div
              key={id}
              className={cn(
                "flex flex-col rounded-[16px] border p-6",
                featured ? "border-accent-border bg-accent-soft/40" : "border-border bg-card",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                {featured && (
                  <span className="text-accent-text text-xs font-medium">Most teams pick this</span>
                )}
              </div>
              <p className="text-muted mt-1 text-sm">{p.tagline}</p>
              <p className="mt-6">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">
                  {money(monthlyEquivalentCents(id, interval))}
                </span>
                <span className="text-muted ml-1.5 text-sm">
                  {p.pricePerSeat ? "per member, per month" : "for up to 5 people"}
                </span>
              </p>
              <p className="text-subtle mt-1 h-5 text-[13px]">
                {p.pricePerSeat
                  ? interval === "year"
                    ? `Billed ${money(seatPrice(id, "year") * 100)} per member each year`
                    : "Billed monthly"
                  : "Free forever"}
              </p>
              <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <Check className="text-success-text mt-0.5 size-4 shrink-0" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className="mt-8"
                variant={featured ? "primary" : "secondary"}
                size="lg"
              >
                <Link href="/signup">{id === "free" ? "Start free" : `Start with ${p.name}`}</Link>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
