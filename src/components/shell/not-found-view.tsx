"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

const subscribe = () => () => {};
const here = () => window.location.pathname + window.location.search;

/** The page for a link that doesn't open. A link into the demo workspace offers to open the demo. */
export function NotFoundView() {
  const path = useSyncExternalStore(subscribe, here, () => "");
  const inDemo = path === "/w/demo" || path.startsWith("/w/demo/") || path.startsWith("/w/demo?");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-[420px] space-y-6 text-center">
        <Logo size={28} className="justify-center" />
        {inDemo ? (
          <>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                This link is part of the live demo
              </h1>
              <p className="text-muted mt-1.5 text-sm">
                The demo opens as a demo visitor, not with your own account. Opening it signs you
                out of your account in this browser. Your work stays as it is, and you can sign back
                in at any time.
              </p>
            </div>
            <div className="space-y-2">
              <form action="/api/demo" method="post">
                <input type="hidden" name="next" value={path} />
                <Button type="submit" size="lg" className="w-full">
                  Open the demo
                </Button>
              </form>
              <Button asChild variant="secondary" size="lg" className="w-full">
                <Link href="/app">Stay in my workspace</Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
              <p className="text-muted mt-1.5 text-sm">
                This page doesn&apos;t exist, or you don&apos;t have access to it. Check the link,
                or ask the person who sent it.
              </p>
            </div>
            <Button asChild size="lg" className="w-full">
              <Link href="/app">Go to Taskora</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
