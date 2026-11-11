import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { DemoButton } from "@/components/auth/forms";
import { requireViewer, listWorkspaces } from "@/lib/workspace";
import { Button } from "@/components/ui/button";
import { leaveDemoToSignUp } from "@/app/(auth)/actions";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Create a workspace" };

export default async function OnboardingPage() {
  const [viewer, workspaces] = await Promise.all([requireViewer(), listWorkspaces()]);
  const first = viewer.name.split(" ")[0];
  if (workspaces.some((w) => w.isDemo)) {
    // The shared demo account: new workspaces belong in a real account.
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-[400px] space-y-6">
          <Logo size={28} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Create your own workspace</h1>
            <p className="text-muted mt-1.5 text-sm leading-relaxed">
              You&apos;re signed in to the shared demo account, which everyone trying Taskora uses.
              Create a free account to get a workspace that&apos;s only yours.
            </p>
          </div>
          <form action={leaveDemoToSignUp}>
            <Button type="submit" size="lg" className="w-full">
              Sign up for free
            </Button>
          </form>
          <Link href="/app" className="text-muted hover:text-fg block text-center text-sm">
            Back to the demo
          </Link>
        </div>
      </main>
    );
  }
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px] space-y-8">
        <Logo size={28} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome, {first}</h1>
          <p className="text-muted mt-1.5 text-sm">
            A workspace is where your team plans projects together. You can invite people next.
          </p>
        </div>
        <OnboardingForm suggestedName={`${first}'s team`} />
        <div className="border-border space-y-3 border-t pt-6">
          <p className="text-muted text-sm">Just looking around?</p>
          <DemoButton />
        </div>
        {workspaces.length > 0 && (
          <Link href="/app" className="text-muted hover:text-fg block text-center text-sm">
            Back to my workspaces
          </Link>
        )}
      </div>
    </main>
  );
}
