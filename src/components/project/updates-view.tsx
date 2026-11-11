"use client";

import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { Loader2, Megaphone, Sparkles, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/menu";
import { Card, EmptyState } from "@/components/ui/surface";
import { HEALTH_LABEL, type Health } from "@/lib/ai/status-update";
import type { UpdateDraft } from "@/lib/ai/update-run";
import { deleteProjectUpdate, postProjectUpdate } from "@/lib/project/update-actions";
import { cn } from "@/lib/utils";
import { RichText } from "./rich-text";
import { useProject } from "./store";

export type ProjectUpdate = {
  id: string;
  health: Health;
  body: string;
  createdAt: string;
  authorId: string | null;
  authorName: string;
};

const TONE = { on_track: "success", at_risk: "warning", off_track: "danger" } as const;
const DOT = { on_track: "bg-success", at_risk: "bg-warning", off_track: "bg-danger" } as const;
const ORDER: Health[] = ["on_track", "at_risk", "off_track"];

function Composer() {
  const { project, canEdit } = useProject();
  const router = useRouter();
  const pathname = usePathname();
  const [health, setHealth] = useState<Health>("on_track");
  const [body, setBody] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draftMode, setDraftMode] = useState<UpdateDraft | null>(null);
  const [posting, startPosting] = useTransition();
  if (!canEdit) return null;

  const draft = async () => {
    setDrafting(true);
    const res: { ok: true; data: UpdateDraft } | { ok: false; error: string } = await fetch(
      "/api/ai/update",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      },
    )
      .then((r) => r.json())
      .catch(() => ({
        ok: false,
        error: "Couldn't reach the AI assistant. Check your connection.",
      }));
    setDrafting(false);
    if (!res.ok) return void toast.error(res.error);
    setHealth(res.data.health);
    setBody(res.data.body);
    setDraftMode(res.data);
  };

  const post = () =>
    startPosting(async () => {
      const res = await postProjectUpdate({ path: pathname, projectId: project.id, health, body });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Update posted · ${project.name} is ${HEALTH_LABEL[health].toLowerCase()}`);
      setBody("");
      setDraftMode(null);
      router.refresh();
    });

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Project health" className="flex flex-wrap gap-1.5">
          {ORDER.map((h) => (
            <button
              key={h}
              type="button"
              role="radio"
              aria-checked={health === h}
              onClick={() => setHealth(h)}
              className={cn(
                "border-border text-muted hover:text-fg rounded-full border px-3 py-1 text-[13px] font-medium transition-colors",
                health === h && "border-fg/25 bg-surface-2 text-fg",
              )}
            >
              <span className={cn("mr-1.5 inline-block size-2 rounded-full", DOT[h])} aria-hidden />
              {HEALTH_LABEL[h]}
            </button>
          ))}
        </div>
        <Button variant="ai" size="sm" className="ml-auto" onClick={draft} disabled={drafting}>
          {drafting ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {body.trim() ? "Redraft with AI" : "Draft with AI"}
        </Button>
      </div>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-label="Update"
        rows={6}
        maxLength={10000}
        placeholder="What shipped, what's at risk, what's next? **Bold** and - lists work."
        className="mt-3 min-h-32"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {draftMode &&
          (draftMode.mode === "demo" ? (
            <Tooltip content="Written by Taskora's rules from this project's tasks and sprint. Add an OpenAI key for live AI.">
              <Badge tone="accent" className="cursor-help">
                Demo AI draft
              </Badge>
            </Tooltip>
          ) : (
            <Badge tone="accent">AI draft</Badge>
          ))}
        {draftMode && (
          <span className="text-subtle text-xs">
            Health suggested from the numbers · {draftMode.creditsLeft} credits left
          </span>
        )}
        <Button className="ml-auto" onClick={post} loading={posting} disabled={!body.trim()}>
          Post update
        </Button>
      </div>
    </Card>
  );
}

export function UpdatesView({
  updates,
  viewerId,
}: {
  updates: ProjectUpdate[];
  viewerId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [deleting, startDeleting] = useTransition();
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-8">
      <Composer />
      {updates.length === 0 ? (
        <EmptyState
          icon={<Megaphone />}
          title="No updates yet"
          description="Post a short weekly update so everyone knows how the project is going."
        />
      ) : (
        <ol className="relative space-y-4" aria-label="Status updates">
          {updates.map((u, i) => (
            <li key={u.id}>
              <Card className={cn("p-4", i === 0 && "border-fg/15")}>
                <div className="flex flex-wrap items-center gap-2">
                  <Avatar name={u.authorName} seed={u.authorId ?? u.authorName} size={24} />
                  <span className="text-sm font-medium">{u.authorName}</span>
                  <Badge tone={TONE[u.health]}>{HEALTH_LABEL[u.health]}</Badge>
                  {i === 0 && <span className="text-subtle text-xs">Latest</span>}
                  <time
                    dateTime={u.createdAt}
                    title={format(parseISO(u.createdAt), "PPpp")}
                    className="text-subtle ml-auto text-xs"
                  >
                    {formatDistanceToNowStrict(parseISO(u.createdAt), { addSuffix: true })}
                  </time>
                  {viewerId && u.authorId === viewerId && (
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() =>
                        startDeleting(async () => {
                          const res = await deleteProjectUpdate({ path: pathname, id: u.id });
                          if (!res.ok) return void toast.error(res.error);
                          toast.success("Update deleted");
                          router.refresh();
                        })
                      }
                      className="text-subtle hover:text-danger rounded p-1"
                      aria-label="Delete update"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <RichText source={u.body} className="text-fg-2 mt-3" />
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
