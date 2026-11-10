import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4",
  {
    variants: {
      tone: {
        neutral: "bg-elevated text-fg-2",
        accent: "bg-accent-soft text-accent-text",
        info: "bg-info-soft text-info-text",
        success: "bg-success-soft text-success-text",
        warning: "bg-warning-soft text-warning-text",
        danger: "bg-danger-soft text-danger-text",
        violet: "bg-violet-soft text-violet-text",
        pink: "bg-pink-soft text-pink-text",
        solid: "bg-accent font-semibold text-accent-fg",
      },
      shape: { pill: "rounded-full", tag: "rounded-md" },
    },
    defaultVariants: { tone: "neutral", shape: "pill" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({
  className,
  tone,
  shape,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone, shape }), className)} {...props} />;
}
