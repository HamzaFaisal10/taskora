import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { DemoButton } from "@/components/auth/forms";
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
      <div className="flex w-full max-w-sm flex-col gap-3 sm:max-w-md sm:flex-row">
        <DemoButton className="flex-1" />
        <Button asChild size="lg" variant="secondary" className="flex-1">
          <Link href="/signup">Create a free workspace</Link>
        </Button>
      </div>
      <Link href="/login" className="text-muted hover:text-fg text-sm">
        Already have an account? Sign in
      </Link>
    </main>
  );
}
