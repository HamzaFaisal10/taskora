import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { DemoButton } from "@/components/auth/forms";
import { requireViewer, listWorkspaces } from "@/lib/workspace";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Create a workspace" };

export default async function OnboardingPage() {
  const [viewer, workspaces] = await Promise.all([requireViewer(), listWorkspaces()]);
  const first = viewer.name.split(" ")[0];
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
