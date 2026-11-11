import { Check, Minus } from "lucide-react";
import type { Metadata } from "next";
import { FinalCta, MarketingFooter, MarketingNav } from "@/components/marketing/chrome";
import { Faq, PricingPlans } from "@/components/marketing/pricing";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Free for up to five people. Pro is $8 and Business $16 per member a month. Guests are free.",
};

type Cell = boolean | string;
const ROWS: { group: string; items: [string, Cell, Cell, Cell][] }[] = [
  {
    group: "Plan work",
    items: [
      ["Active projects", "3", "Unlimited", "Unlimited"],
      ["Members", "Up to 5", "Up to 25", "Unlimited"],
      ["Guests", true, true, true],
      ["Board, list and calendar", true, true, true],
      ["Timeline", true, true, true],
      ["Sprints and burndown", true, true, true],
      ["Subtasks and dependencies", true, true, true],
    ],
  },
  {
    group: "Automate and collect",
    items: [
      ["Automation rules", true, true, true],
      ["Public request forms", true, true, true],
      ["AI credits a month", "20", "200", "Unlimited"],
    ],
  },
  {
    group: "Measure",
    items: [
      ["Goals and key results", true, true, true],
      ["Analytics", true, true, true],
      ["Time tracking and CSV export", true, true, true],
    ],
  },
  {
    group: "Admin",
    items: [
      ["Roles: owner, admin, member, guest", true, true, true],
      ["Priority support", false, false, true],
    ],
  },
];

function Value({ v }: { v: Cell }) {
  if (v === true)
    return <Check className="text-success-text mx-auto size-4" aria-label="Included" />;
  if (v === false)
    return <Minus className="text-subtle mx-auto size-4" aria-label="Not included" />;
  return <span>{v}</span>;
}

async function isSignedIn() {
  if (!isSupabaseConfigured()) return false;
  try {
    const { data } = await (await createClient()).auth.getUser();
    return Boolean(data.user);
  } catch {
    return false;
  }
}

export default async function PricingPage() {
  const signedIn = await isSignedIn();
  return (
    <>
      <MarketingNav signedIn={signedIn} />
      <main>
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-20">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
            Pay per member, only when the team grows
          </h1>
          <p className="text-muted mt-4 max-w-xl text-lg">
            Free stays free for up to five people. Guests never use a seat, and you can change plans
            any time.
          </p>
          <div className="mt-10">
            <PricingPlans />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" aria-labelledby="compare">
          <h2 id="compare" className="text-2xl font-semibold tracking-[-0.015em]">
            Compare plans
          </h2>
          <div className="border-border mt-6 overflow-x-auto rounded-[16px] border">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-border bg-surface border-b">
                  <th className="px-5 py-3 text-left font-medium">
                    <span className="sr-only">Feature</span>
                  </th>
                  <th className="w-32 py-3 text-center font-semibold">Free</th>
                  <th className="w-32 py-3 text-center font-semibold">Pro</th>
                  <th className="w-32 py-3 text-center font-semibold">Business</th>
                </tr>
              </thead>
              {ROWS.map((g) => (
                <tbody key={g.group}>
                  <tr>
                    <th
                      colSpan={4}
                      scope="colgroup"
                      className="text-fg px-5 pt-6 pb-2 text-left text-[13px] font-semibold"
                    >
                      {g.group}
                    </th>
                  </tr>
                  {g.items.map(([label, free, pro, biz]) => (
                    <tr key={label} className="border-border-subtle border-t">
                      <th scope="row" className="text-muted px-5 py-3 text-left font-normal">
                        {label}
                      </th>
                      <td className="py-3 text-center tabular-nums">
                        <Value v={free} />
                      </td>
                      <td className="py-3 text-center tabular-nums">
                        <Value v={pro} />
                      </td>
                      <td className="py-3 text-center tabular-nums">
                        <Value v={biz} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <h2 className="mb-6 text-2xl font-semibold tracking-[-0.015em]">Questions</h2>
          <Faq />
        </section>
        <FinalCta />
      </main>
      <MarketingFooter />
    </>
  );
}
