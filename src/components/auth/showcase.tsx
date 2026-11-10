import { CheckCircle2, Circle, CircleDashed, Sparkles } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

const columns = [
  {
    title: "In progress",
    icon: CircleDashed,
    tone: "text-warning",
    cards: [
      { ref: "MOB-131", title: "Offline mode for saved carts", who: "Ayesha Khan", tag: "Mobile" },
      { ref: "WEB-74", title: "Checkout: Apple Pay button", who: "Zain Malik", tag: "Payments" },
    ],
  },
  {
    title: "Done",
    icon: CheckCircle2,
    tone: "text-success",
    cards: [
      {
        ref: "MOB-128",
        title: "Push notification opt-in flow",
        who: "Omar Siddiqui",
        tag: "Growth",
      },
      { ref: "WEB-70", title: "Order history pagination", who: "Priya Nair", tag: "Web" },
    ],
  },
];

/** Right-hand panel on the auth pages: a small, static preview of the product. */
export function AuthShowcase() {
  return (
    <aside className="bg-surface border-border relative hidden overflow-hidden border-l lg:flex lg:flex-col lg:justify-center lg:px-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60 [background:radial-gradient(60%_50%_at_70%_20%,var(--accent-soft),transparent)]"
      />
      <div className="relative max-w-xl">
        <p className="text-accent-text text-sm font-medium">Sprint 12 · Halcyon Labs</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
          Plan the sprint, ship the work, skip the status meeting.
        </h2>

        <div className="mt-10 grid grid-cols-2 gap-4">
          {columns.map((col) => (
            <div key={col.title} className="space-y-3">
              <div className="text-muted flex items-center gap-2 text-[13px] font-medium">
                <col.icon className={`size-4 ${col.tone}`} aria-hidden />
                {col.title}
              </div>
              {col.cards.map((card) => (
                <div
                  key={card.ref}
                  className="bg-card border-border rounded-card border p-3.5 shadow-sm"
                >
                  <div className="text-subtle font-mono text-[11px]">{card.ref}</div>
                  <div className="mt-1 text-sm leading-snug font-medium">{card.title}</div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="bg-elevated text-muted rounded-full px-2 py-0.5 text-[11px]">
                      {card.tag}
                    </span>
                    <Avatar name={card.who} size={22} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="bg-card border-accent-border rounded-card mt-4 flex items-start gap-3 border p-3.5">
          <Sparkles className="text-accent-text mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="text-fg-2 text-[13px] leading-relaxed">
            <span className="text-fg font-medium">AI summary:</span> 9 of 14 tasks done, 2 at risk.
            Checkout is blocked on the Stripe webhook review.
          </p>
        </div>

        <ul className="text-muted mt-10 space-y-2 text-sm">
          {[
            "Boards, lists, calendar and timeline",
            "Sprints, goals and automations",
            "Free for small teams",
          ].map((line) => (
            <li key={line} className="flex items-center gap-2">
              <Circle className="text-accent size-2 fill-current" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
