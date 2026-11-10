import type { Metadata } from "next";
import { formatDistanceToNowStrict } from "date-fns";
import { Bell, CheckCheck } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/surface";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import { markAllRead } from "./actions";

export const metadata: Metadata = { title: "Inbox" };

type Row = {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  actor: { id: string; full_name: string; avatar_url: string | null } | null;
  task: { number: number; title: string; projects: { key: string } } | null;
};

export default async function InboxPage({ params }: PageProps<"/w/[slug]/inbox">) {
  const { slug } = await params;
  const { workspace, viewer, unreadCount } = await getWorkspaceContext(slug);
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select(
      "id, title, body, read_at, created_at, actor:profiles!notifications_actor_id_fkey(id, full_name, avatar_url), task:tasks(number, title, projects(key))",
    )
    .eq("workspace_id", workspace.id)
    .eq("user_id", viewer.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader
        title="Inbox"
        description={unreadCount ? `${unreadCount} unread` : "You're up to date"}
        actions={
          unreadCount > 0 && (
            <form action={markAllRead.bind(null, slug, workspace.id)}>
              <Button type="submit" variant="secondary" size="sm">
                <CheckCheck /> Mark all read
              </Button>
            </form>
          )
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={<Bell />}
          title="No notifications"
          description="Mentions, assignments and comments on tasks you follow show up here."
        />
      ) : (
        <ul>
          {rows.map((n) => (
            <li key={n.id} className="border-border-subtle flex gap-3 border-b px-4 py-3.5 sm:px-8">
              <Avatar
                name={n.actor?.full_name ?? "Taskora"}
                src={n.actor?.avatar_url}
                seed={n.actor?.id}
                size={30}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{n.actor?.full_name ?? "Taskora"}</span>{" "}
                  <span className="text-muted">{n.title}</span>
                </p>
                {n.task && (
                  <p className="mt-0.5 truncate text-sm">
                    <span className="text-subtle font-mono text-[11px]">
                      {n.task.projects.key}-{n.task.number}
                    </span>{" "}
                    {n.task.title}
                  </p>
                )}
                {n.body && <p className="text-muted mt-1 line-clamp-2 text-[13px]">{n.body}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <time className="text-subtle text-xs" dateTime={n.created_at}>
                  {formatDistanceToNowStrict(new Date(n.created_at), { addSuffix: true })}
                </time>
                <span
                  className={cn("size-2 rounded-full", n.read_at ? "bg-transparent" : "bg-accent")}
                  aria-label={n.read_at ? undefined : "Unread"}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
