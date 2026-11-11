"use client";

import { ArrowLeft, CreditCard, Info, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/input";
import { Card } from "@/components/ui/surface";
import { confirmDemoPayment } from "@/lib/billing/actions";
import { money } from "@/lib/billing/plans";

/**
 * Demo checkout. It never asks for card details: it shows the standard Stripe test card as text and,
 * on confirm, switches the plan and records a demo invoice. No payment provider is contacted.
 */
export function DemoCheckout({
  slug,
  plan,
  planName,
  pricePerSeat,
  seats,
  email,
  workspaceName,
}: {
  slug: string;
  plan: "pro" | "business";
  planName: string;
  pricePerSeat: number;
  seats: number;
  email: string;
  workspaceName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const total = pricePerSeat * seats * 100;

  return (
    <div className="space-y-5">
      <Link
        href={`/w/${slug}/settings/billing`}
        className="text-muted hover:text-fg inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to billing
      </Link>

      <div
        className="bg-info-soft text-info-text rounded-card flex gap-3 p-3.5 text-sm"
        role="note"
      >
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          <strong className="font-semibold">Demo payment — no real charge.</strong> This portfolio
          build runs billing in demo mode, so no card is collected and nothing is sent to a payment
          provider. With Stripe keys added, this button opens Stripe Checkout in test mode instead.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Order summary</h2>
          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Plan</dt>
              <dd>Taskora {planName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Workspace</dt>
              <dd className="truncate">{workspaceName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Seats</dt>
              <dd className="tabular-nums">
                {seats} × {money(pricePerSeat * 100)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Billing</dt>
              <dd>Monthly</dd>
            </div>
            <div className="border-border flex justify-between gap-4 border-t pt-3 text-base font-semibold">
              <dt>Due today</dt>
              <dd className="tabular-nums">{money(total)}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold">Payment method</h2>
          <div className="border-border bg-surface rounded-control mt-4 border p-3.5">
            <div className="flex items-center gap-2.5">
              <CreditCard className="text-muted size-5" aria-hidden />
              <div className="text-sm">
                <p className="font-mono tracking-wider">4242 4242 4242 4242</p>
                <p className="text-subtle text-xs">Stripe test card · 12/34 · CVC 123</p>
              </div>
            </div>
          </div>
          <p className="text-subtle mt-2 text-xs">Receipt goes to {email}.</p>
          <FieldError>{error}</FieldError>
          <Button
            size="lg"
            className="mt-4 w-full"
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await confirmDemoPayment({ slug, plan });
                if (!res.ok) return setError(res.error);
                router.push(`/w/${slug}/settings/billing?checkout=success`);
              })
            }
          >
            <Lock /> Pay {money(total)} (demo)
          </Button>
        </Card>
      </div>
    </div>
  );
}
