"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Check, Mail, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { RichText } from "@/components/project/rich-text";
import { PriorityIcon, type Priority } from "@/components/tasks/task-meta";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { markRead, resolveRequest } from "@/app/w/[slug]/inbox/actions";
import { cn } from "@/lib/utils";

export type InboxNotification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  actor: { id: string; name: string; avatarUrl: string | null } | null;
  task: { ref: string; title: string; href: string } | null;
};

/** One notification. Opening it marks it read and goes to the task. */
export function NotificationItem({ slug, n }: { slug: string; n: InboxNotification }) {
  const router = useRouter();
  const [read, setRead] = useState(n.read);
  const open = () => {
    if (!read) {
      setRead(true);
      void markRead({ slug, id: n.id });
    }
  };
  const content = (
    <>
      <Avatar
        name={n.actor?.name ?? "Taskora"}
        src={n.actor?.avatarUrl}
        seed={n.actor?.id}
        size={30}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-medium">{n.actor?.name ?? "Taskora"}</span>{" "}
          <span className="text-muted">{n.title}</span>
        </p>
        {n.task && (
          <p className="mt-0.5 truncate text-sm">
            <span className="text-subtle font-mono text-[11px]">{n.task.ref}</span> {n.task.title}
          </p>
        )}
        {n.body && <p className="text-muted mt-1 line-clamp-2 text-[13px]">{n.body}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <time className="text-subtle text-xs" dateTime={n.createdAt}>
          {formatDistanceToNowStrict(new Date(n.createdAt), { addSuffix: true })}
        </time>
        <span
          className={cn("size-2 rounded-full", read ? "bg-transparent" : "bg-accent")}
          aria-label={read ? undefined : "Unread"}
        />
      </div>
    </>
  );
  const cls =
    "border-border-subtle flex gap-3 border-b px-4 py-3.5 sm:px-8 hover:bg-surface/60 focus-visible:bg-surface outline-none";
  return (
    <li>
      {n.task ? (
        <Link href={n.task.href} onClick={open} className={cls}>
          {content}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => {
            open();
            router.refresh();
          }}
          className={cn(cls, "w-full text-left")}
        >
          {content}
        </button>
      )}
    </li>
  );
}

export type InboxRequest = {
  id: string;
  ref: string;
  title: string;
  description: string;
  priority: Priority;
  createdAt: string;
  source: string;
  requesterEmail: string | null;
  creatorName: string | null;
  project: { name: string; color: string };
  href: string;
};

/** A request waiting in a project's Triage column, with Accept and Decline. */
export function RequestCard({
  slug,
  r,
  canResolve,
}: {
  slug: string;
  r: InboxRequest;
  canResolve: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);

  const resolve = (decision: "accept" | "decline", assignToMe = false) =>
    start(async () => {
      const res = await resolveRequest({ slug, taskId: r.id, decision, assignToMe });
      if (!res.ok) return void toast.error(res.error);
      const label =
        decision === "accept"
          ? `Accepted ${r.ref} · moved to ${res.data}${assignToMe ? " and assigned to you" : ""}`
          : res.data === "Archived"
            ? `Declined ${r.ref} · archived`
            : `Declined ${r.ref} · moved to ${res.data}`;
      setDone(label);
      toast.success(label);
      router.refresh();
    });

  return (
    <li
      className={cn(
        "border-border bg-card rounded-card border p-4 transition-opacity",
        (pending || done) && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span
          className="size-2.5 rounded-[3px]"
          style={{ background: r.project.color }}
          aria-hidden
        />
        <span className="text-muted">{r.project.name}</span>
        <span className="text-subtle font-mono">{r.ref}</span>
        {r.source === "form" && <Badge tone="info">Form</Badge>}
        <time className="text-subtle ml-auto" dateTime={r.createdAt}>
          {formatDistanceToNowStrict(new Date(r.createdAt), { addSuffix: true })}
        </time>
      </div>
      <Link
        href={r.href}
        className="mt-2 flex items-start gap-2 text-[15px] font-medium hover:underline"
      >
        <PriorityIcon priority={r.priority} />
        <span>{r.title}</span>
      </Link>
      {(r.requesterEmail || r.creatorName) && (
        <p className="text-muted mt-1 flex items-center gap-1.5 text-[13px]">
          <Mail className="size-3.5" aria-hidden />
          From {r.requesterEmail ?? r.creatorName}
        </p>
      )}
      {r.description && (
        <div className="border-border-subtle mt-3 max-h-40 overflow-hidden border-l-2 pl-3">
          <RichText source={r.description} className="text-fg-2 text-[13px]" />
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {done ? (
          <span className="text-muted text-sm">{done}</span>
        ) : canResolve ? (
          <>
            <Button size="sm" onClick={() => resolve("accept")} disabled={pending}>
              <Check /> Accept
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => resolve("accept", true)}
              disabled={pending}
            >
              Accept and assign to me
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="sm:ml-auto"
              onClick={() => resolve("decline")}
              disabled={pending}
            >
              <X /> Decline
            </Button>
          </>
        ) : (
          <span className="text-subtle text-sm">Only members can accept or decline requests.</span>
        )}
      </div>
    </li>
  );
}
