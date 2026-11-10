import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("rounded-card border-border bg-surface border", className)} {...props} />
  );
}

export function Separator({
  className,
  vertical = false,
}: {
  className?: string;
  vertical?: boolean;
}) {
  return (
    <div
      role="separator"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      className={cn("bg-border shrink-0", vertical ? "h-full w-px" : "h-px w-full", className)}
    />
  );
}

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div aria-hidden className={cn("bg-elevated animate-pulse rounded-md", className)} {...props} />
  );
}

export function Progress({
  value,
  className,
  tone = "accent",
  label,
}: {
  value: number;
  className?: string;
  tone?: "accent" | "warning" | "danger" | "info" | "success";
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const fill = {
    accent: "bg-accent",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-info",
    success: "bg-success",
  }[tone];
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
      className={cn("bg-elevated h-1.5 w-full overflow-hidden rounded-full", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-300", fill)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      {icon && (
        <div className="rounded-card border-border bg-surface text-muted flex size-11 items-center justify-center border [&_svg]:size-5">
          {icon}
        </div>
      )}
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-fg font-semibold">{title}</p>
        {description && <p className="text-muted text-[13px]">{description}</p>}
      </div>
      {action}
    </div>
  );
}
