"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, LogOut, Plus, Search, Square, Star } from "lucide-react";
import { useTheme } from "next-themes";
import { useTransition } from "react";
import { toast } from "sonner";
import { clock } from "@/components/time/format";
import { useElapsed } from "@/components/time/use-elapsed";
import { stopTimer } from "@/lib/time-actions";
import { signOut } from "@/app/(auth)/actions";
import { LogoMark } from "@/components/brand/logo";
import { THEME_OPTIONS } from "@/components/theme";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { settingsNav, workspaceNav } from "./nav";
import { useNewProject } from "./new-project";
import { useWorkspace } from "./workspace-provider";

const PLAN_LABEL = { free: "Free", pro: "Pro", business: "Business" } as const;

function NavLink({
  href,
  active,
  children,
  onNavigate,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-control text-muted hover:bg-elevated hover:text-fg flex h-8 items-center gap-2.5 px-2 text-[13px] font-medium transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
        active && "bg-elevated text-fg",
      )}
    >
      {children}
    </Link>
  );
}

function WorkspaceSwitcher() {
  const { workspace, workspaces } = useWorkspace();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-control hover:bg-elevated flex h-10 w-full min-w-0 items-center gap-2.5 px-2 text-left transition-colors outline-none">
        <span className="bg-accent text-accent-fg flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-bold">
          {workspace.name[0]?.toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{workspace.name}</span>
        <ChevronsUpDown className="text-subtle size-3.5 shrink-0" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.id} asChild>
            <Link href={`/w/${w.slug}`}>
              <span className="bg-elevated text-fg flex size-5 items-center justify-center rounded text-[10px] font-bold">
                {w.name[0]?.toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              {w.isDemo && <Badge tone="accent">Demo</Badge>}
              {w.id === workspace.id && <Check className="!text-accent-text" />}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding">
            <Plus /> Create workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { viewer, workspace } = useWorkspace();
  const { theme, setTheme } = useTheme();
  const [signingOut, startSignOut] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-control hover:bg-elevated flex h-11 w-full min-w-0 items-center gap-2.5 px-2 text-left transition-colors outline-none">
        <Avatar name={viewer.name} src={viewer.avatarUrl} seed={viewer.id} size={26} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{viewer.name}</span>
          <span className="text-subtle block truncate text-[11px]">
            {workspace.isDemo ? "Demo account" : viewer.email}
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" className="w-60">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? "dark"} onValueChange={setTheme}>
          {THEME_OPTIONS.map((t) => (
            <DropdownMenuRadioItem key={t.value} value={t.value}>
              <t.icon /> {t.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        {/* Called directly: a form inside the menu is removed when the menu closes, before it submits. */}
        <DropdownMenuItem
          disabled={signingOut}
          onSelect={(e) => {
            e.preventDefault();
            startSignOut(() => signOut());
          }}
        >
          <LogOut /> {workspace.isDemo ? "Leave demo" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RunningTimer() {
  const { workspace, runningTimer } = useWorkspace();
  const elapsed = useElapsed(runningTimer?.startedAt ?? null);
  const [pending, start] = useTransition();
  if (!runningTimer) return null;
  return (
    <div className="border-accent-border bg-accent-soft/50 rounded-control mb-2 flex items-center gap-2 border px-2 py-1.5">
      <span className="bg-accent size-2 shrink-0 animate-pulse rounded-full" aria-hidden />
      <Link
        href={`/w/${workspace.slug}/p/${runningTimer.projectKey}?task=${runningTimer.ref}`}
        className="min-w-0 flex-1"
        title={runningTimer.title}
      >
        <span className="text-fg block truncate text-xs font-medium">{runningTimer.title}</span>
        <span className="text-muted font-mono text-[11px] tabular-nums">{clock(elapsed)}</span>
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await stopTimer();
            if (!res.ok) toast.error(res.error);
          })
        }
        className="text-muted hover:text-fg hover:bg-elevated rounded p-1"
        aria-label="Stop timer"
      >
        <Square className="size-3.5 fill-current" />
      </button>
    </div>
  );
}

export function Sidebar({
  onNavigate,
  onSearch,
}: {
  onNavigate?: () => void;
  onSearch: () => void;
}) {
  const { workspace, projects, unreadCount } = useWorkspace();
  const newProject = useNewProject();
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);
  const favorites = projects.filter((p) => p.favorite);

  return (
    <nav aria-label="Workspace" className="flex h-full flex-col gap-1 px-2.5 py-3">
      <WorkspaceSwitcher />

      <button
        type="button"
        onClick={onSearch}
        className="rounded-control border-border text-subtle hover:text-fg bg-card my-2 flex h-8 items-center gap-2 border px-2 text-[13px] transition-colors"
      >
        <Search className="size-3.5" aria-hidden />
        <span className="flex-1 text-left">Search or jump to…</span>
        <Kbd>⌘K</Kbd>
      </button>

      {workspaceNav(workspace.slug).map((item) => (
        <NavLink
          key={item.label}
          href={item.href}
          active={isActive(item.href, item.exact)}
          onNavigate={onNavigate}
        >
          <item.icon aria-hidden />
          <span className="flex-1">{item.label}</span>
          {item.badge === "inbox" && unreadCount > 0 && (
            <span className="bg-accent text-accent-fg rounded-full px-1.5 text-[10px] leading-4 font-bold">
              {unreadCount}
            </span>
          )}
        </NavLink>
      ))}

      <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto">
        {favorites.length > 0 && (
          <section>
            <h2 className="text-subtle px-2 pb-1 text-[11px] font-medium tracking-wide uppercase">
              Favorites
            </h2>
            {favorites.map((p) => (
              <NavLink
                key={p.id}
                href={`/w/${workspace.slug}/p/${p.key}`}
                active={pathname.startsWith(`/w/${workspace.slug}/p/${p.key}`)}
                onNavigate={onNavigate}
              >
                <Star className="!text-warning fill-current" aria-hidden />
                <span className="truncate">{p.name}</span>
              </NavLink>
            ))}
          </section>
        )}
        <section>
          <div className="flex items-center justify-between pr-1">
            <h2 className="text-subtle px-2 pb-1 text-[11px] font-medium tracking-wide uppercase">
              Projects
            </h2>
            {workspace.role !== "guest" && (
              <button
                type="button"
                onClick={newProject}
                className="text-subtle hover:text-fg hover:bg-elevated -mt-1 rounded p-1"
                aria-label="New project"
                title="New project"
              >
                <Plus className="size-3.5" />
              </button>
            )}
          </div>
          {projects.length === 0 && (
            <button
              type="button"
              onClick={newProject}
              className="text-muted hover:text-fg hover:bg-elevated rounded-control flex h-8 w-full items-center gap-2 px-2 text-left text-[13px]"
            >
              <Plus className="size-4" aria-hidden /> Create your first project
            </button>
          )}
          {projects.map((p) => (
            <NavLink
              key={p.id}
              href={`/w/${workspace.slug}/p/${p.key}`}
              active={pathname.startsWith(`/w/${workspace.slug}/p/${p.key}`)}
              onNavigate={onNavigate}
            >
              <span
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ background: p.color }}
                aria-hidden
              />
              <span className="flex-1 truncate">{p.name}</span>
              <span className="text-subtle font-mono text-[10px]">{p.key}</span>
            </NavLink>
          ))}
        </section>
        <section>
          <h2 className="text-subtle px-2 pb-1 text-[11px] font-medium tracking-wide uppercase">
            Workspace
          </h2>
          {settingsNav(workspace.slug)
            .slice(0, 1)
            .map((item) => (
              <NavLink
                key={item.label}
                href={item.href}
                active={isActive(item.href)}
                onNavigate={onNavigate}
              >
                <item.icon aria-hidden />
                {item.label}
              </NavLink>
            ))}
        </section>
      </div>

      <div className="border-border mt-2 border-t pt-2">
        <RunningTimer />
        <div className="text-subtle flex items-center gap-2 px-2 pb-2 text-[11px]">
          <LogoMark size={14} variant="mono" />
          <span>{PLAN_LABEL[workspace.plan]} plan</span>
          {workspace.isDemo && (
            <Badge tone="accent" className="ml-auto">
              Demo
            </Badge>
          )}
        </div>
        <UserMenu />
      </div>
    </nav>
  );
}
