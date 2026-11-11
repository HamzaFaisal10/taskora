"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { slug: "general", label: "General" },
  { slug: "members", label: "Members" },
  { slug: "labels", label: "Labels" },
  { slug: "billing", label: "Billing" },
  { slug: "profile", label: "Your profile" },
];

export function SettingsTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings" className="-mb-px flex [scrollbar-width:none] overflow-x-auto">
      {TABS.map((t) => {
        const href = `/w/${slug}/settings/${t.slug}`;
        const active = pathname.startsWith(href);
        return (
          <Link
            key={t.slug}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "text-muted hover:text-fg border-b-2 border-transparent px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors",
              active && "text-fg border-accent",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
