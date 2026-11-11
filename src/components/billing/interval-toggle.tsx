"use client";

import type { BillingInterval } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

/** Monthly / Yearly switch for plan prices. */
export function IntervalToggle({
  value,
  onChange,
  className,
}: {
  value: BillingInterval;
  onChange: (v: BillingInterval) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Billing period"
      className={cn("border-border bg-surface inline-flex rounded-full border p-0.5", className)}
    >
      {(["month", "year"] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "text-muted hover:text-fg rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
            value === v && "bg-elevated text-fg shadow-sm",
          )}
        >
          {v === "month" ? "Monthly" : "Yearly"}
          {v === "year" && (
            <span
              className={cn("ml-1.5 text-xs", value === v ? "text-success-text" : "text-subtle")}
            >
              2 months free
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
