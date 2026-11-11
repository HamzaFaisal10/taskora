import type { Metadata } from "next";
import { AtSign, Bell, CheckCheck, Inbox, UserRound } from "lucide-react";
import Link from "next/link";
import {
  NotificationItem,
  RequestCard,
  type InboxNotification,
  type InboxRequest,
} from "@/components/inbox/inbox-items";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/surface";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import { markAllRead } from "./actions";

export const metadata: Metadata = { title: "Inbox" };

type Tab = "all" | "mentions" | "assigned" | "requests";
const KINDS: Record<Exclude<Tab, "requests">, string[] | null> = {
  all: null,
  mentions: ["mentioned"],
  assigned: ["assigned"],
};

type Row = {
  id: string;
  kind: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  actor: { id: string; full_name: string; avatar_url: string | null } | null;
  task: { number: number; title: string; projects: { key: string } } | null;
};

type RequestRow = {
  id: string;
  number: number;
  title: string;
  description: string;
  priority: InboxRequest["priority"];
  created_at: string;
  source: string;
  requester_email: string | null;
  creator: { full_name: string } | null;
  projects: { key: string; name: string; color: string };
};

export default async function InboxPage({ params, searchParams }: PageProps<"/w/[slug]/inbox">) {
  const { slug } = await params;
  const raw = (await searchParams).tab;
  const tab: Tab = (["all", "mentions", "assigned", "requests"] as const).includes(raw as Tab)
    ? (raw as Tab)
    : "all";
  const { workspace, viewer, unreadCount } = await getWorkspaceContext(slug);
  const supabase = await createClient();

  const [notifications, requests] = await Promise.all([
    supabase
      .from("notifications")
      .select(
        "id, kind, title, body, read_at, created_at, actor:profiles!notifications_actor_id_fkey(id, full_name, avatar_url), task:tasks(number, title, projects(key))",
      )
      .eq("workspace_id", workspace.id)
      .eq("user_id", viewer.id)
      .order("created_at", { ascending: false })
      .limit(150),
    supabase
      .from("tasks")
      .select(
        "id, number, title, description, priority, created_at, source, requester_email, creator:profiles!tasks_creator_id_fkey(full_name), projects!inner(key, name, color, archived_at), task_statuses!inner(category)",
      )
      .eq("workspace_id", workspace.id)
      .eq("task_statuses.category", "triage")
      .is("archived_at", null)
      .is("projects.archived_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const rows = (notifications.data ?? []) as unknown as Row[];
  const inTab = (t: Exclude<Tab, "requests">) =>
    KINDS[t] ? rows.filter((r) => KINDS[t]!.includes(r.kind)) : rows;
  const unreadIn = (t: Exclude<Tab, "requests">) => inTab(t).filter((r) => !r.read_at).length;
  const requestRows = (requests.data ?? []) as unknown as RequestRow[];

  const TABS: { id: Tab; label: string; icon: typeof Bell; count: number }[] = [
    { id: "all", label: "All", icon: Bell, count: unreadIn("all") },
    { id: "mentions", label: "Mentions", icon: AtSign, count: unreadIn("mentions") },
    { id: "assigned", label: "Assigned to me", icon: UserRound, count: unreadIn("assigned") },
    { id: "requests", label: "Requests", icon: Inbox, count: requestRows.length },
  ];

  const list: InboxNotification[] =
    tab === "requests"
      ? []
      : inTab(tab).map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          read: !!n.read_at,
          createdAt: n.created_at,
          actor: n.actor
            ? { id: n.actor.id, name: n.actor.full_name, avatarUrl: n.actor.avatar_url }
            : null,
          task: n.task
            ? {
                ref: `${n.task.projects.key}-${n.task.number}`,
                title: n.task.title,
                href: `/w/${slug}/p/${n.task.projects.key}?task=${n.task.projects.key}-${n.task.number}`,
              }
            : null,
        }));

  const requestList: InboxRequest[] = requestRows.map((r) => ({
    id: r.id,
    ref: `${r.projects.key}-${r.number}`,
    title: r.title,
    description: r.description,
    priority: r.priority,
    createdAt: r.created_at,
    source: r.source,
    requesterEmail: r.requester_email,
    creatorName: r.creator?.full_name ?? null,
    project: { name: r.projects.name, color: r.projects.color },
    href: `/w/${slug}/p/${r.projects.key}?task=${r.projects.key}-${r.number}`,
  }));

  const tabUnread = tab === "requests" ? 0 : unreadIn(tab);
  const EMPTY: Record<Tab, { title: string; description: string }> = {
    all: {
      title: "No notifications",
      description: "Mentions, assignments, comments and new requests show up here.",
    },
    mentions: {
      title: "No mentions",
      description: "When someone writes @your name in a comment, it lands here.",
    },
    assigned: {
      title: "Nothing assigned",
      description: "Tasks people assign to you show up here.",
    },
    requests: {
      title: "No requests waiting",
      description:
        "Form submissions and guest requests wait here until someone accepts or declines them.",
    },
  };

  return (
    <>
      <PageHeader
        title="Inbox"
        description={unreadCount ? `${unreadCount} unread` : "You're up to date"}
        actions={
          tabUnread > 0 && (
            <form
              action={markAllRead.bind(
                null,
                slug,
                workspace.id,
                KINDS[tab as Exclude<Tab, "requests">] ?? undefined,
              )}
            >
              <Button type="submit" variant="secondary" size="sm">
                <CheckCheck /> Mark all read
              </Button>
            </form>
          )
        }
      />
      <nav
        aria-label="Inbox sections"
        className="border-border -mt-2 flex [scrollbar-width:none] overflow-x-auto border-b px-2 sm:px-6 [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "all" ? `/w/${slug}/inbox` : `/w/${slug}/inbox?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn(
              "text-muted hover:text-fg relative flex h-10 items-center gap-1.5 px-2.5 text-[13px] font-medium whitespace-nowrap",
              tab === t.id &&
                "text-fg after:bg-accent after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full",
            )}
          >
            <t.icon className="size-4" aria-hidden />
            {t.label}
            {t.count > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] leading-[18px] tabular-nums",
                  t.id === "requests" ? "bg-surface-2 text-fg-2" : "bg-accent text-accent-fg",
                )}
              >
                {t.count}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {tab === "requests" ? (
        requestList.length === 0 ? (
          <EmptyState icon={<Inbox />} {...EMPTY.requests} />
        ) : (
          <ul className="mx-auto max-w-3xl space-y-3 px-4 py-5 sm:px-8">
            {requestList.map((r) => (
              <RequestCard key={r.id} slug={slug} r={r} canResolve={workspace.role !== "guest"} />
            ))}
          </ul>
        )
      ) : list.length === 0 ? (
        <EmptyState icon={<Bell />} {...EMPTY[tab]} />
      ) : (
        <ul>
          {list.map((n) => (
            <NotificationItem key={n.id} slug={slug} n={n} />
          ))}
        </ul>
      )}
    </>
  );
}
