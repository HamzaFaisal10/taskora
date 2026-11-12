import { Check, ShieldCheck } from "lucide-react";
import Link from "next/link";
import {
  FinalCta,
  MainActions,
  MarketingFooter,
  MarketingNav,
} from "@/components/marketing/chrome";
import { ProductTour, ScreensStage } from "@/components/marketing/devices";
import { Faq, PricingPlans } from "@/components/marketing/pricing";
import {
  AiVisual,
  AnalyticsVisual,
  FormVisual,
  RuleVisual,
  SprintVisual,
  TimeVisual,
} from "@/components/marketing/visuals";
import { marketingViewer } from "@/lib/marketing-viewer";

function Feature({
  title,
  children,
  visual,
  flip = false,
}: {
  title: string;
  children: React.ReactNode;
  visual: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-8 py-14 sm:py-20 lg:grid-cols-2 lg:gap-16">
      <div className={flip ? "lg:order-2" : undefined}>
        <h3 className="max-w-md text-2xl font-semibold tracking-[-0.015em] text-balance sm:text-3xl">
          {title}
        </h3>
        <div className="text-muted mt-4 max-w-md space-y-3 leading-relaxed">{children}</div>
      </div>
      <div className={flip ? "lg:order-1" : undefined}>{visual}</div>
    </div>
  );
}

export default async function HomePage() {
  const viewer = await marketingViewer();
  return (
    <>
      <MarketingNav viewer={viewer} />
      <main>
        {/* Hero: a short pitch and the two main actions, then the product itself on a coloured panel. */}
        <section className="relative isolate overflow-hidden">
          <div className="hero-grid pointer-events-none absolute inset-0 -z-10" aria-hidden />
          <div
            className="bg-accent/20 dark:bg-accent/12 pointer-events-none absolute -top-48 right-[-12%] -z-10 size-[640px] rounded-full blur-[130px]"
            aria-hidden
          />
          <div className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-24">
            <h1 className="from-fg to-fg/65 max-w-4xl bg-gradient-to-b bg-clip-text pb-2 text-[2.9rem] leading-[1.02] font-semibold tracking-[-0.045em] text-transparent sm:text-7xl lg:text-[5.4rem]">
              Plan the sprint.
              <br />
              Ship the work.
            </h1>
            <p className="text-muted mt-5 max-w-xl text-lg leading-relaxed sm:text-xl">
              Tasks, sprints and client requests in one fast workspace, with rules that handle the
              busywork.
            </p>
            <MainActions viewer={viewer} />
            <p className="text-subtle mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <Check className="text-accent-text size-3.5" aria-hidden /> No card needed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="text-accent-text size-3.5" aria-hidden /> Demo opens without
                sign-up
              </span>
            </p>
          </div>
          <div className="mx-auto max-w-6xl px-4 pt-14 pb-16 sm:px-6 sm:pt-16 sm:pb-24">
            <div className="stage-bg border-border overflow-hidden rounded-[28px] border px-[4%] pt-[5%]">
              <ScreensStage
                desktop="board"
                phone="home"
                path="/w/halcyon/p/MOB"
                desktopAlt="The board of the Mobile App project in the demo workspace"
                phoneAlt="Home on a phone: tasks assigned to you, overdue work and unread updates"
                priority
              />
            </div>
          </div>
        </section>

        <section id="features" className="border-border bg-surface/40 scroll-mt-14 border-y">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="max-w-2xl text-2xl font-semibold tracking-[-0.015em] text-balance sm:text-3xl">
              One project, five ways to look at it
            </h2>
            <p className="text-muted mt-3 max-w-2xl leading-relaxed">
              These are the real screens of the demo workspace. Search and filters carry across
              every view, and each task has its own shareable link.
            </p>
            <div className="mt-8">
              <ProductTour />
            </div>
          </div>
        </section>

        <section className="divide-border mx-auto max-w-6xl divide-y px-4 sm:px-6">
          <Feature title="Know by Wednesday whether the sprint will land" visual={<SprintVisual />}>
            <p>
              Each sprint has a goal, a window and a burndown drawn from the work that&apos;s
              actually finished.
            </p>
            <p>
              When it ends, unfinished tasks move to the next sprint in one step, and past sprints
              keep their velocity.
            </p>
          </Feature>
          <Feature flip title="Rules that do the busywork" visual={<RuleVisual />}>
            <p>
              When a task moves to review, assign it to your lead. When it&apos;s done, stop the
              timers and close its subtasks.
            </p>
            <p>
              Rules run inside the database the moment a task changes, so they work from every
              screen, and one rule can never set off another in a loop.
            </p>
          </Feature>
          <Feature title="Requests arrive as tasks, not emails" visual={<FormVisual />}>
            <p>
              Publish a bug report or feature request form and share the link. Clients don&apos;t
              need an account.
            </p>
            <p>
              Every answer lands in the project&apos;s Triage column with its priority and the
              sender&apos;s email already filled in.
            </p>
          </Feature>
          <Feature flip title="Turn a vague task into a plan" visual={<AiVisual />}>
            <p>
              Ask the assistant to break a task into subtasks, summarize a long thread in three
              lines, or draft acceptance criteria.
            </p>
            <p>
              This build answers with demo responses built from the task itself, and says so on
              every answer.
            </p>
          </Feature>
          <Feature
            title="See where the work and the hours go"
            visual={
              <div className="grid gap-4 sm:grid-cols-2">
                <AnalyticsVisual />
                <TimeVisual />
              </div>
            }
          >
            <p>
              Analytics compares the last 30 days with the 30 before: throughput, cycle time,
              overdue work and who&apos;s overloaded.
            </p>
            <p>
              Start a timer from any task, keep it running while you move around, and export the
              week as CSV.
            </p>
          </Feature>
        </section>

        <section className="border-border border-y">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:px-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-10">
            <ShieldCheck className="text-accent-text size-8" aria-hidden />
            <div>
              <h2 className="text-lg font-semibold">Your workspace is only yours</h2>
              <ul className="text-muted mt-3 grid gap-x-10 gap-y-2 text-sm leading-relaxed sm:grid-cols-2">
                <li>Access is checked in the database on every row, not just in the interface.</li>
                <li>Guests see only the projects you share and can&apos;t create work.</li>
                <li>Billing and plan details can only be changed on the server.</li>
                <li>
                  Public forms reach the database through two narrow functions and nothing else.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl scroll-mt-14 px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-[-0.02em]">Simple pricing</h2>
          <p className="text-muted mt-3 max-w-xl">
            Start free. Pay per member when the team grows. Guests are always free.
          </p>
          <div className="mt-10">
            <PricingPlans />
          </div>
          <p className="text-subtle mt-4 text-sm">
            <Link href="/pricing" className="hover:text-fg underline underline-offset-2">
              Compare every feature
            </Link>
          </p>
        </section>

        <section id="faq" className="mx-auto max-w-3xl scroll-mt-14 px-4 pb-8 sm:px-6">
          <h2 className="mb-6 text-3xl font-semibold tracking-[-0.02em]">Questions</h2>
          <Faq />
        </section>

        <FinalCta viewer={viewer} />
      </main>
      <MarketingFooter viewer={viewer} />
    </>
  );
}
