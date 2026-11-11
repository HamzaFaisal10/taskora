import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

export function DueLabel({
  date,
  done,
  className,
}: {
  date: string | null;
  done?: boolean;
  className?: string;
}) {
  if (!date) return null;
  const d = parseISO(date);
  const diff = differenceInCalendarDays(d, new Date());
  const label =
    diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : format(d, "MMM d");
  return (
    <span
      suppressHydrationWarning
      className={cn(
        "text-muted text-xs tabular-nums",
        !done && diff < 0 && "text-danger-text",
        !done && diff === 0 && "text-warning-text",
        className,
      )}
    >
      {label}
    </span>
  );
}
