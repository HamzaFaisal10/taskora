import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/surface";

export default function NotFound() {
  return (
    <EmptyState
      className="min-h-[60dvh]"
      title="Not found"
      description="This page doesn't exist, or you don't have access to it."
      action={
        <Button asChild variant="secondary">
          <Link href="/app">Go to my workspace</Link>
        </Button>
      }
    />
  );
}
