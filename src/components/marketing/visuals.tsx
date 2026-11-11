import { ArrowRight, Sparkles, Zap } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

/** Small, static product snippets for the feature rows. Real UI pieces, drawn with demo data. */

export function SprintVisual() {
  const actual = [39, 36, 34, 31, 31, 28, 27, 27];
  const W = 320;
  const H = 120;
  const x = (i: number) => 12 + (i / 13) * (W - 24);
  const y = (v: number) => 10 + (1 - v / 39) * (H - 28);
  return (
    <div className="border-border bg-card rounded-[14px] border p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">Sprint 12</p>
        <p className="text-muted text-xs">5 days left</p>
      </div>
      <p className="text-muted mt-0.5 text-xs">Payments and onboarding ready for beta</p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 h-auto w-full"
        role="img"
        aria-label="Burndown: 27 of 39 points left with 5 days to go"
      >
        <line
          x1={x(0)}
          y1={y(39)}
          x2={x(13)}
          y2={y(0)}
          className="stroke-subtle"
          strokeDasharray="4 4"
          strokeWidth={1.5}
        />
        <path
          d={actual.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ")}
          fill="none"
          className="stroke-chart-1"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={x(7)} cy={y(27)} r={4} className="fill-chart-1" />
        <line x1={12} x2={W - 12} y1={H - 18} y2={H - 18} className="stroke-border" />
      </svg>
      <div className="text-muted mt-1 flex gap-4 text-xs">
        <span>
          <span className="text-fg font-semibold tabular-nums">12</span> of 39 points done
        </span>
        <span>
          <span className="text-fg font-semibold tabular-nums">5</span> of 12 tasks
        </span>
      </div>
    </div>
  );
}

export function RuleVisual() {
  return (
    <div className="border-border bg-card space-y-3 rounded-[14px] border p-4">
      {[
        {
          name: "Review goes to Sara",
          when: "A task moves to In review",
          then: "Assign to Sara and notify her",
          runs: 41,
        },
        {
          name: "Clean up finished tasks",
          when: "A task moves to Done",
          then: "Stop timers and complete subtasks",
          runs: 58,
        },
      ].map((r) => (
        <div key={r.name} className="flex gap-3">
          <span className="bg-accent-soft text-accent-text flex size-7 shrink-0 items-center justify-center rounded-[8px]">
            <Zap className="size-3.5" aria-hidden />
          </span>
          <div className="min-w-0 text-[13px]">
            <p className="font-semibold">{r.name}</p>
            <p className="text-muted mt-0.5 leading-relaxed">
              {r.when} <ArrowRight className="mx-0.5 inline size-3" aria-label="then" /> {r.then}
            </p>
            <p className="text-subtle mt-1 text-xs">Ran {r.runs} times</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function FormVisual() {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
      <div className="border-border bg-card rounded-[14px] border p-4">
        <p className="text-sm font-semibold">Report a bug</p>
        <div className="mt-3 space-y-2">
          <div className="border-border bg-surface text-fg-2 rounded-[8px] border px-2.5 py-2 text-xs">
            Invoice PDF shows a blank page
          </div>
          <div className="border-border bg-surface text-muted rounded-[8px] border px-2.5 py-2 text-xs">
            How urgent? High
          </div>
          <div className="bg-accent text-accent-fg rounded-[8px] px-2.5 py-2 text-center text-xs font-semibold">
            Send
          </div>
        </div>
      </div>
      <ArrowRight className="text-subtle mx-auto size-4 rotate-90 sm:rotate-0" aria-hidden />
      <div className="border-border bg-card rounded-[14px] border p-4">
        <p className="text-muted text-xs">Triage · Customer Portal</p>
        <div className="border-border bg-surface mt-2 rounded-[10px] border p-3">
          <p className="text-subtle font-mono text-[11px]">CUS-66</p>
          <p className="mt-1 text-[13px] font-medium">Invoice PDF shows a blank page</p>
          <p className="text-muted mt-2 text-xs">From tester@example.com · High</p>
        </div>
      </div>
    </div>
  );
}

export function AiVisual() {
  return (
    <div className="border-border bg-card rounded-[14px] border p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="text-accent-text size-4" aria-hidden />
        <p className="text-sm font-semibold">Suggested subtasks</p>
        <span className="bg-accent-soft text-accent-text rounded-full px-2 py-0.5 text-[11px] font-medium">
          Demo AI
        </span>
      </div>
      <ul className="mt-3 space-y-1.5 text-[13px]">
        {[
          ["Create products and prices in Stripe", 1],
          ["Verify webhook signatures", 3],
          ["Sync the plan on subscription changes", 2],
          ["Test upgrades and failed payments", 2],
        ].map(([t, p]) => (
          <li key={t} className="flex items-center gap-2.5">
            <span
              className="bg-accent text-accent-fg flex size-4 items-center justify-center rounded-[4px] text-[10px] font-bold"
              aria-hidden
            >
              ✓
            </span>
            <span className="flex-1">{t}</span>
            <span className="text-subtle text-xs tabular-nums">{p} pt</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AnalyticsVisual() {
  const weeks = [6, 13, 21, 28, 29, 31, 36, 30];
  const max = 40;
  return (
    <div className="border-border bg-card rounded-[14px] border p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">Completed per week</p>
        <p className="text-muted text-xs">Last 8 weeks</p>
      </div>
      <div
        className="mt-4 flex h-28 items-end gap-2"
        role="img"
        aria-label="Completed tasks per week rising from 6 to 36"
      >
        {weeks.map((w, i) => (
          <div
            key={i}
            className="bg-chart-1 flex-1 rounded-t-[4px]"
            style={{ height: `${(w / max) * 100}%` }}
          />
        ))}
      </div>
      <div className="border-border mt-3 grid grid-cols-3 gap-2 border-t pt-3 text-xs">
        <div>
          <p className="text-muted">Done, 30 days</p>
          <p className="mt-0.5 text-base font-semibold tabular-nums">124</p>
        </div>
        <div>
          <p className="text-muted">Cycle time</p>
          <p className="mt-0.5 text-base font-semibold tabular-nums">4.0 d</p>
        </div>
        <div>
          <p className="text-muted">Overdue</p>
          <p className="text-danger-text mt-0.5 text-base font-semibold tabular-nums">2</p>
        </div>
      </div>
    </div>
  );
}

export function TimeVisual() {
  return (
    <div className="border-border bg-card rounded-[14px] border p-4">
      <div className="border-accent-border bg-accent-soft/50 flex items-center gap-2.5 rounded-[10px] border px-3 py-2">
        <span className="bg-accent size-2 rounded-full" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
          Crash on Android 14 login
        </span>
        <span className="font-mono text-xs tabular-nums">00:42:17</span>
      </div>
      <ul className="mt-3 space-y-2 text-[13px]">
        {[
          ["Alex Morgan", "6.4 h"],
          ["Sara Rehman", "3.5 h"],
          ["Zain Malik", "1.7 h"],
        ].map(([n, h]) => (
          <li key={n} className="flex items-center gap-2.5">
            <Avatar name={n} size={20} />
            <span className="flex-1">{n}</span>
            <span className="tabular-nums">{h}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
