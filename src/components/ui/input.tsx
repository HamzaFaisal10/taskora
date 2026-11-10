import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-control border border-border bg-card px-3 text-sm text-fg placeholder:text-subtle transition-colors outline-none focus-visible:border-accent focus-visible:outline-none aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} className={cn(fieldBase, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(fieldBase, "min-h-20 resize-y py-2.5 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-fg-2 text-[13px] font-medium", className)} {...props} />;
}

export function FieldError({ id, children }: { id?: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-danger-text text-xs">
      {children}
    </p>
  );
}

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "border-border text-muted inline-flex h-5 min-w-5 items-center justify-center rounded border px-1.5 font-mono text-[11px]",
        className,
      )}
      {...props}
    />
  );
}
