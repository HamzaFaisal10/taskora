import { cn } from "@/lib/utils";

export type StatusGroup = "backlog" | "unstarted" | "started" | "review" | "completed" | "canceled";
export type Priority = "none" | "low" | "medium" | "high" | "urgent";

/** Status ring: outline for not-started states, filled for active and done. */
export function StatusDot({
  color,
  group,
  className,
  size = 10,
}: {
  color: string;
  group: StatusGroup;
  className?: string;
  size?: number;
}) {
  const filled = group === "started" || group === "completed";
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block shrink-0 rounded-full border-2",
        group === "canceled" && "opacity-60",
        className,
      )}
      style={{
        width: size,
        height: size,
        borderColor: color,
        background: filled ? color : "transparent",
      }}
    />
  );
}

export const PRIORITY_META: Record<Priority, { label: string; className: string; bars: number }> = {
  urgent: { label: "Urgent", className: "text-danger-text", bars: 4 },
  high: { label: "High", className: "text-warning-text", bars: 3 },
  medium: { label: "Medium", className: "text-info", bars: 2 },
  low: { label: "Low", className: "text-muted", bars: 1 },
  none: { label: "No priority", className: "text-subtle", bars: 0 },
};

/** Signal-bar priority icon with a text label for screen readers. */
export function PriorityIcon({
  priority,
  showLabel = false,
}: {
  priority: Priority;
  showLabel?: boolean;
}) {
  const meta = PRIORITY_META[priority];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-[11px] font-semibold", meta.className)}
    >
      {priority === "urgent" ? (
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <rect width="14" height="14" rx="3.5" fill="currentColor" />
          <rect x="6.25" y="3" width="1.5" height="5" rx=".75" fill="var(--bg)" />
          <rect x="6.25" y="9.5" width="1.5" height="1.5" rx=".75" fill="var(--bg)" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          {[0, 1, 2].map((i) => (
            <rect
              key={i}
              x={1 + i * 4.5}
              y={9 - i * 3.5}
              width="3"
              height={4 + i * 3.5}
              rx="1"
              fill="currentColor"
              opacity={i < meta.bars ? 1 : 0.25}
            />
          ))}
        </svg>
      )}
      {showLabel ? meta.label : <span className="sr-only">{meta.label}</span>}
    </span>
  );
}
