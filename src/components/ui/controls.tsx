"use client";

import {
  Checkbox as CheckboxPrimitive,
  Select as SelectPrimitive,
  Switch as SwitchPrimitive,
  Tabs as TabsPrimitive,
} from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/* ------------------------------- Checkbox ------------------------------- */

export function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "border-subtle data-[state=checked]:border-accent data-[state=checked]:bg-accent flex size-4 shrink-0 items-center justify-center rounded-[4px] border bg-transparent transition-colors",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="text-accent-fg size-3" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

/* -------------------------------- Switch -------------------------------- */

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "bg-elevated ring-border data-[state=checked]:bg-accent data-[state=checked]:ring-accent relative inline-flex h-5 w-9 shrink-0 items-center rounded-full ring-1 transition-colors",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="bg-fg data-[state=checked]:bg-accent-fg block size-4 translate-x-0.5 rounded-full shadow transition-transform data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
}

/* --------------------------------- Tabs --------------------------------- */

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

/** Segmented control look (Board / List / Calendar). */
export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "rounded-control border-border bg-surface inline-flex items-center gap-1 border p-[3px]",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "text-muted hover:text-fg data-[state=active]:bg-elevated data-[state=active]:text-fg inline-flex h-[30px] items-center gap-1.5 rounded-md px-3 text-[13px] transition-colors [&_svg]:size-3.5",
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------- Select -------------------------------- */

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  "aria-label": ariaLabel,
  disabled,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  options: { value: string; label: React.ReactNode }[];
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  disabled?: boolean;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          "rounded-control border-border bg-card text-fg focus-visible:border-accent data-[placeholder]:text-subtle inline-flex h-10 w-full items-center justify-between gap-2 border px-3 text-sm outline-none",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="text-muted size-4" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="rounded-card border-border bg-surface shadow-pop animate-pop z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden border p-1"
        >
          <SelectPrimitive.Viewport>
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value}
                className="text-fg data-[highlighted]:bg-elevated relative flex h-8 items-center rounded-md pr-8 pl-2 text-sm outline-none select-none"
              >
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2">
                  <Check className="text-accent-text size-4" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
