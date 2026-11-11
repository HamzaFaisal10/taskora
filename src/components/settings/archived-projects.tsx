"use client";

import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/surface";
import { restoreProject } from "@/lib/project/project-actions";

export function ArchivedProjects({
  slug,
  projects,
  canEdit,
}: {
  slug: string;
  projects: { id: string; name: string; color: string; archivedAt: string }[];
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  if (projects.length === 0) return null;
  return (
    <section className="mt-8">
      <h3 className="mb-2 text-[13px] font-semibold">Archived projects</h3>
      <Card className="divide-border-subtle divide-y p-0">
        {projects.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <span className="size-2.5 rounded-[3px]" style={{ background: p.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <span className="text-subtle text-xs">
              archived {formatDistanceToNowStrict(parseISO(p.archivedAt), { addSuffix: true })}
            </span>
            {canEdit && (
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await restoreProject({ slug, projectId: p.id });
                    if (!res.ok) toast.error(res.error);
                    else toast.success(`${p.name} restored`);
                  })
                }
              >
                Restore
              </Button>
            )}
          </div>
        ))}
      </Card>
    </section>
  );
}
