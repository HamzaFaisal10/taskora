import Link from "next/link";
import { DemoButton } from "@/components/auth/forms";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import type { MarketingViewer } from "@/lib/marketing-viewer";

export function MarketingNav({ viewer }: { viewer: MarketingViewer }) {
  return (
    <header className="border-border/60 bg-bg/85 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="Taskora home">
          <Logo size={24} />
        </Link>
        <nav aria-label="Main" className="text-muted hidden items-center gap-5 text-sm md:flex">
          <Link href="/#features" className="hover:text-fg">
            Features
          </Link>
          <Link href="/pricing" className="hover:text-fg">
            Pricing
          </Link>
          <Link href="/#faq" className="hover:text-fg">
            FAQ
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {viewer === "user" ? (
            <Button asChild size="sm">
              <Link href="/app">Open Taskora</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              {viewer === "demo" ? (
                <Button asChild size="sm" variant="secondary">
                  <Link href="/w/demo">Open the demo</Link>
                </Button>
              ) : (
                <DemoButton size="sm" variant="secondary" label="Live demo" />
              )}
              <Button asChild size="sm">
                <Link href="/signup">Start free</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * The two main actions, the same at the top and the bottom of the page. A visitor tries the demo or
 * signs up; someone with their own account opens it (the demo would sign them out, so it is a link
 * to a page that says so first).
 */
export function MainActions({ viewer }: { viewer: MarketingViewer }) {
  if (viewer === "user") {
    return (
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/app">Open Taskora</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/w/demo">View the live demo</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
      {viewer === "demo" ? (
        <Button asChild size="lg" className="sm:w-64">
          <Link href="/w/demo">Open the demo</Link>
        </Button>
      ) : (
        <DemoButton className="sm:w-64" variant="primary" label="Try the live demo" />
      )}
      <Button asChild size="lg" variant="secondary">
        <Link href="/signup">Create a free workspace</Link>
      </Button>
    </div>
  );
}

export function MarketingFooter({ viewer }: { viewer: MarketingViewer }) {
  return (
    <footer className="border-border border-t">
      <div className="text-muted mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-8 text-sm sm:px-6">
        <Logo size={20} />
        <Link href="/pricing" className="hover:text-fg">
          Pricing
        </Link>
        {viewer === "user" ? (
          <Link href="/app" className="hover:text-fg">
            Open Taskora
          </Link>
        ) : (
          <>
            <Link href="/login" className="hover:text-fg">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-fg">
              Create account
            </Link>
          </>
        )}
        <span className="text-subtle ml-auto">© {new Date().getFullYear()} Taskora</span>
      </div>
    </footer>
  );
}

export function FinalCta({ viewer }: { viewer: MarketingViewer }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.02em] text-balance sm:text-[2.75rem] sm:leading-[1.1]">
        Open the demo workspace and move a card.
      </h2>
      <p className="text-muted mt-4 max-w-xl text-lg">
        Eight teammates, four projects and two months of history are waiting. No sign-up, and it
        resets every night.
      </p>
      <MainActions viewer={viewer} />
    </section>
  );
}
