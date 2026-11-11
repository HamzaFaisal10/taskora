"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { Menu, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "./command-palette";
import { NewProjectProvider } from "./new-project";
import { Sidebar } from "./sidebar";
import { WorkspaceProvider, type WorkspaceContextValue } from "./workspace-provider";

export function AppShell({
  value,
  children,
}: {
  value: WorkspaceContextValue;
  children: React.ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    document.cookie = `taskora-ws=${value.workspace.slug}; path=/; max-age=31536000; samesite=lax`;
  }, [value.workspace.slug]);

  // Close the mobile drawer after navigating.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setDrawer(false);
  }

  return (
    <WorkspaceProvider value={value}>
      <NewProjectProvider>
        {value.workspace.isDemo && (
          <div className="bg-accent text-accent-fg px-4 py-1.5 text-center text-xs font-medium">
            You’re exploring a live demo workspace. Changes reset every night.
          </div>
        )}
        <div className="flex min-h-0 flex-1">
          <aside className="border-border bg-surface hidden w-64 shrink-0 border-r lg:block">
            <div className="sticky top-0 h-dvh">
              <Sidebar onSearch={() => setPalette(true)} />
            </div>
          </aside>

          <DialogPrimitive.Root open={drawer} onOpenChange={setDrawer}>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="bg-overlay fixed inset-0 z-40 lg:hidden" />
              <DialogPrimitive.Content
                aria-describedby={undefined}
                className="bg-surface border-border fixed inset-y-0 left-0 z-50 w-[min(18rem,85vw)] border-r lg:hidden"
              >
                <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
                <Sidebar
                  onNavigate={() => setDrawer(false)}
                  onSearch={() => {
                    setDrawer(false);
                    setPalette(true);
                  }}
                />
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="border-border bg-bg/90 sticky top-0 z-30 flex h-12 items-center gap-2 border-b px-3 backdrop-blur lg:hidden">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Open navigation"
                onClick={() => setDrawer(true)}
              >
                <Menu />
              </Button>
              <LogoMark size={22} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {value.workspace.name}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Search"
                onClick={() => setPalette(true)}
              >
                <Search />
              </Button>
            </header>
            <main className="min-w-0 flex-1">{children}</main>
          </div>
        </div>
        <CommandPalette open={palette} onOpenChange={setPalette} />
      </NewProjectProvider>
    </WorkspaceProvider>
  );
}
