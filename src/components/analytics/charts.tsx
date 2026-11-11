"use client";

import { useId, useState } from "react";
import type { WeekPoint } from "@/lib/analytics/compute";
import { cn } from "@/lib/utils";

function niceMax(v: number) {
  if (v <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  const n = Math.ceil(v / step);
  const nice = n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * step >= v ? nice * step : (nice + 1) * step;
}

/** Tooltip anchored at a horizontal position given in percent of the chart width. */
function Tooltip({ pct, children }: { pct: number; children: React.ReactNode }) {
  const flip = pct > 60;
  return (
    <div
      role="status"
      className="bg-elevated border-border shadow-pop rounded-control pointer-events-none absolute top-2 z-10 min-w-36 border px-3 py-2 text-xs"
      style={flip ? { right: `calc(${100 - pct}% + 14px)` } : { left: `calc(${pct}% + 14px)` }}
    >
      {children}
    </div>
  );
}

/** Completed tasks per week as bars, created tasks as a dashed context line. One y-axis: task counts. */
export function FlowChart({ data }: { data: WeekPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const titleId = useId();
  const W = 640;
  const H = 240;
  const pad = { l: 32, r: 12, t: 12, b: 28 };
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.completed, d.created)), 1));
  const band = (W - pad.l - pad.r) / data.length;
  const bw = Math.min(28, band * 0.55);
  const cx = (i: number) => pad.l + band * i + band / 2;
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const line = data.map((d, i) => `${i ? "L" : "M"}${cx(i)},${y(d.created)}`).join(" ");
  const ticks = [0, max / 2, max];
  const last = data.at(-1);

  return (
    <figure aria-labelledby={titleId}>
      <figcaption className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 id={titleId} className="text-sm font-semibold">
          Created vs completed
        </h3>
        <span className="text-muted flex items-center gap-1.5 text-xs">
          <span className="bg-chart-1 size-2.5 rounded-[3px]" aria-hidden />
          Completed
        </span>
        <span className="text-muted flex items-center gap-1.5 text-xs">
          <span className="border-chart-context w-4 border-t-2 border-dashed" aria-hidden />
          Created
        </span>
        <button
          type="button"
          onClick={() => setTable((v) => !v)}
          className="text-subtle hover:text-fg ml-auto text-xs underline-offset-2 hover:underline"
        >
          {table ? "Show chart" : "View as table"}
        </button>
      </figcaption>
      {table ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-subtle border-border border-b text-left text-xs">
              <th className="py-2 font-medium">Week of</th>
              <th className="py-2 text-right font-medium">Created</th>
              <th className="py-2 text-right font-medium">Completed</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.start} className="border-border-subtle border-b">
                <td className="py-1.5">{d.label}</td>
                <td className="py-1.5 text-right tabular-nums">{d.created}</td>
                <td className="py-1.5 text-right tabular-nums">{d.completed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative" onMouseLeave={() => setHover(null)}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full"
            role="img"
            aria-label={`Tasks created and completed per week. Last week: ${last?.created ?? 0} created, ${last?.completed ?? 0} completed.`}
          >
            {ticks.map((v) => (
              <g key={v}>
                <line
                  x1={pad.l}
                  x2={W - pad.r}
                  y1={y(v)}
                  y2={y(v)}
                  className="stroke-border-subtle"
                />
                <text
                  x={pad.l - 8}
                  y={y(v) + 3.5}
                  textAnchor="end"
                  className="fill-subtle text-[10px] tabular-nums"
                >
                  {v}
                </text>
              </g>
            ))}
            {hover !== null && (
              <rect
                x={pad.l + band * hover}
                y={pad.t}
                width={band}
                height={H - pad.t - pad.b}
                className="fill-elevated"
                opacity={0.6}
              />
            )}
            {data.map((d, i) => {
              const h = y(0) - y(d.completed);
              const r = Math.min(4, h / 2, bw / 2);
              const x0 = cx(i) - bw / 2;
              const top = y(d.completed);
              return h > 0 ? (
                <path
                  key={d.start}
                  d={`M${x0},${y(0)} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + bw - r} Q${x0 + bw},${top} ${x0 + bw},${top + r} V${y(0)} Z`}
                  className="fill-chart-1"
                />
              ) : null;
            })}
            <path
              d={line}
              fill="none"
              className="stroke-chart-context"
              strokeWidth={2}
              strokeDasharray="5 4"
              strokeLinejoin="round"
            />
            {data.map((d, i) => (
              <circle
                key={d.start}
                cx={cx(i)}
                cy={y(d.created)}
                r={hover === i ? 4.5 : 3}
                className="fill-card stroke-chart-context"
                strokeWidth={2}
              />
            ))}
            {data.map((d, i) =>
              i % Math.ceil(data.length / 8) === 0 || i === data.length - 1 ? (
                <text
                  key={d.start}
                  x={cx(i)}
                  y={H - 8}
                  textAnchor="middle"
                  className="fill-subtle text-[10px]"
                >
                  {i === data.length - 1 ? "This week" : d.label}
                </text>
              ) : null,
            )}
            {last && last.completed > 0 && (
              <text
                x={cx(data.length - 1)}
                y={y(last.completed) - 6}
                textAnchor="middle"
                className="fill-fg text-[10.5px] font-semibold tabular-nums"
              >
                {last.completed}
              </text>
            )}
            {data.map((d, i) => (
              <rect
                key={d.start}
                x={pad.l + band * i}
                y={0}
                width={band}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                tabIndex={-1}
              />
            ))}
          </svg>
          {hover !== null && (
            <Tooltip pct={(cx(hover) / W) * 100}>
              <p className="text-fg mb-1 font-medium">
                {hover === data.length - 1 ? "This week (so far)" : `Week of ${data[hover].label}`}
              </p>
              <p className="text-muted flex justify-between gap-4">
                <span>Completed</span>
                <span className="text-fg tabular-nums">{data[hover].completed}</span>
              </p>
              <p className="text-muted flex justify-between gap-4">
                <span>Created</span>
                <span className="text-fg tabular-nums">{data[hover].created}</span>
              </p>
            </Tooltip>
          )}
        </div>
      )}
    </figure>
  );
}

/** Horizontal bars: open tasks per person, overdue share marked separately. */
export function WorkloadChart({
  rows,
}: {
  rows: { id: string; name: string; open: number; overdue: number; points: number }[];
}) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(...rows.map((r) => r.open), 1);
  return (
    <figure>
      <figcaption className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 className="text-sm font-semibold">Open work by person</h3>
        <span className="text-muted flex items-center gap-1.5 text-xs">
          <span className="bg-chart-1 size-2.5 rounded-[3px]" aria-hidden />
          On schedule
        </span>
        <span className="text-muted flex items-center gap-1.5 text-xs">
          <span className="bg-danger size-2.5 rounded-[3px]" aria-hidden />
          Overdue
        </span>
      </figcaption>
      {rows.length === 0 ? (
        <p className="text-subtle py-6 text-center text-sm">No open work.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => {
            const onTime = r.open - r.overdue;
            return (
              <li
                key={r.id}
                className={cn(
                  "grid grid-cols-[7.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 rounded-md text-[13px]",
                  hover === r.id && "bg-elevated/60",
                )}
                onMouseEnter={() => setHover(r.id)}
                onMouseLeave={() => setHover(null)}
                title={`${r.name}: ${r.open} open (${r.overdue} overdue), ${r.points} points`}
              >
                <span className="truncate">{r.name}</span>
                <span className="flex h-3.5 gap-0.5" aria-hidden>
                  {onTime > 0 && (
                    <span
                      className="bg-chart-1 rounded-l-[4px] last:rounded-r-[4px]"
                      style={{ width: `${(onTime / max) * 100}%` }}
                    />
                  )}
                  {r.overdue > 0 && (
                    <span
                      className="bg-danger rounded-r-[4px] first:rounded-l-[4px]"
                      style={{ width: `${(r.overdue / max) * 100}%` }}
                    />
                  )}
                </span>
                <span className="text-muted text-right tabular-nums">
                  {r.open}
                  <span className="sr-only"> open, {r.overdue} overdue</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </figure>
  );
}
