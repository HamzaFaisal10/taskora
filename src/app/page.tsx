import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

// Temporary home page. The full marketing landing page arrives in a later phase.
export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo size={36} />
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">
        Ship work, not status updates.
      </h1>
      <p className="text-muted max-w-xl text-lg">
        The fast, focused workspace for product teams. Boards, timelines, sprints and AI planning.
      </p>
      <Button asChild size="lg">
        <Link href="/styleguide">View the design system</Link>
      </Button>
    </main>
  );
}
