import { Skeleton } from "@/components/ui/surface";

/** Shown under the project toolbar while switching views (board, list, calendar…). */
export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex gap-3 overflow-hidden px-4 pt-4 sm:px-8"
    >
      {[0, 1, 2, 3].map((c) => (
        <div key={c} className="w-[280px] shrink-0 space-y-2.5">
          <Skeleton className="h-5 w-28" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-[10px]" style={{ opacity: 1 - i * 0.25 }} />
          ))}
        </div>
      ))}
    </div>
  );
}
