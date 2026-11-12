import Link from "next/link";
import { DemoButton } from "@/components/auth/forms";
import { Logo, LogoMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { ScreensStage } from "@/components/marketing/devices";
import type { MarketingViewer } from "@/lib/marketing-viewer";
import { cn } from "@/lib/utils";

/** A one-line note above the header, like a product announcement. It scrolls away with the page. */
function AnnouncementBar() {
  return (
    <div className="border-border/60 bg-surface text-fg-2 border-b px-4 py-2 text-center text-[13px] leading-snug">
      Plan a whole project from a one-line brief with AI, now on every plan.{" "}
      <Link
        href="/w/demo"
        className="text-fg decoration-accent font-medium whitespace-nowrap underline decoration-2 underline-offset-[3px] hover:decoration-[3px]"
      >
        Try it in the demo
      </Link>
    </div>
  );
}

export function MarketingNav({ viewer }: { viewer: MarketingViewer }) {
  return (
    <>
      <AnnouncementBar />
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
              <>
                <Button asChild size="sm" variant="secondary" className="demo-glow">
                  <Link href="/w/demo">Live demo</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/app">Open Taskora</Link>
                </Button>
              </>
            ) : (
              <>
                {viewer === "demo" ? (
                  <Button asChild size="sm" variant="secondary" className="demo-glow">
                    <Link href="/w/demo">Live demo</Link>
                  </Button>
                ) : (
                  <DemoButton size="sm" variant="secondary" label="Live demo" glow />
                )}
                <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/signup">Start free</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  );
}

/**
 * The two main actions, the same for everyone and the same at the top and the bottom of the page:
 * try the demo, or create a workspace.
 */
export function MainActions({
  viewer,
  center = false,
}: {
  viewer: MarketingViewer;
  center?: boolean;
}) {
  return (
    <div className={`mt-8 flex flex-col gap-3 sm:flex-row ${center ? "sm:justify-center" : ""}`}>
      {viewer === "out" ? (
        <DemoButton className="sm:w-64" variant="primary" label="Try the live demo" glow />
      ) : (
        // Already in the demo: go straight back. With your own account: a page explains the switch first.
        <Button asChild size="lg" className="demo-glow sm:w-64">
          <Link href="/w/demo">Try the live demo</Link>
        </Button>
      )}
      <Button asChild size="lg" variant="secondary">
        <Link href={viewer === "user" ? "/onboarding" : "/signup"}>Create a free workspace</Link>
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

/**
 * The closing call to action: a lime panel with the two main actions, and the product rising out of
 * its bottom edge.
 */
export function FinalCta({ viewer }: { viewer: MarketingViewer }) {
  // Dark buttons on the lime panel, in both themes. The light around the demo button stays white.
  const dark =
    "bg-[#0e0f11] text-white hover:bg-[#23262b] shadow-[0_10px_30px_-10px_rgb(0_0_0/0.5)] [--glow:rgb(255_255_255/0.9)]";
  const light = "bg-white/85 text-[#0e0f11] hover:bg-white backdrop-blur";
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="cta-bg relative overflow-hidden rounded-[32px] px-5 pt-14 text-center text-[#0e0f11] sm:px-10 sm:pt-20">
        <LogoMark
          size={64}
          variant="inverse"
          className="mx-auto rounded-[18px] shadow-[0_16px_40px_-12px_rgb(0_0_0/0.45)]"
        />
        <h2 className="mx-auto mt-8 max-w-3xl text-[2.4rem] leading-[1.05] font-semibold tracking-[-0.035em] text-balance sm:text-6xl">
          Stop chasing updates.
          <br />
          Start shipping.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-[#0e0f11]/75">
          Open the demo and move a card in ten seconds, or set up your own workspace in a minute.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {viewer === "out" ? (
            <DemoButton className="sm:w-60" label="Try the live demo" glow buttonClassName={dark} />
          ) : (
            <Button asChild size="lg" className={cn("demo-glow sm:w-60", dark)}>
              <Link href="/w/demo">Try the live demo</Link>
            </Button>
          )}
          <Button asChild size="lg" className={light}>
            <Link href={viewer === "user" ? "/onboarding" : "/signup"}>
              Create a free workspace
            </Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-[#0e0f11]/65">Free for up to 5 people. No card needed.</p>
        <div className="mt-12 sm:mt-16">
          <ScreensStage
            desktop="timeline"
            phone="task"
            path="/w/halcyon/p/MOB/timeline"
            desktopAlt="The timeline of the Mobile App project"
            phoneAlt="A task on a phone, with its status, assignee, dates and custom fields"
          />
        </div>
      </div>
    </section>
  );
}
