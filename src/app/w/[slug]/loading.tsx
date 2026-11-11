import { Skeleton } from "@/components/ui/surface";

/** Shown inside the app shell the moment a link is clicked, while the next page loads. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="px-4 py-6 sm:px-8">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-[12px]" />
        ))}
      </div>
      <div className="mt-8 space-y-2.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-11" style={{ opacity: 1 - i * 0.13 }} />
        ))}
      </div>
    </div>
  );
}
