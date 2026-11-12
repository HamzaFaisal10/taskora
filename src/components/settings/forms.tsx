"use client";

import { plural } from "@/lib/plural";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError, Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/surface";
import {
  deleteLabel,
  deleteWorkspace,
  saveLabel,
  updateProfile,
  updateWorkspace,
} from "@/lib/settings-actions";
import { cn } from "@/lib/utils";

export function GeneralForm({
  slug,
  name,
  canEdit,
  isDemo,
  isOwner,
}: {
  slug: string;
  name: string;
  canEdit: boolean;
  isDemo: boolean;
  isOwner: boolean;
}) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleteError, setDeleteError] = useState<string>();
  const [deleting, startDelete] = useTransition();

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <form
          className="space-y-4"
          action={(form) =>
            start(async () => {
              const res = await updateWorkspace({
                slug,
                name: String(form.get("name")),
                newSlug: String(form.get("slug")),
              });
              if (!res.ok) return setError(res.error);
              setError(undefined);
              toast.success("Workspace updated");
            })
          }
        >
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input id="ws-name" name="name" defaultValue={name} disabled={!canEdit} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-slug">Workspace URL</Label>
            <div className="border-border bg-card focus-within:border-accent rounded-control flex h-10 items-center border text-sm">
              <span className="text-subtle pl-3 select-none">taskora.app/w/</span>
              <input
                id="ws-slug"
                name="slug"
                defaultValue={slug}
                disabled={!canEdit || isDemo}
                className="text-fg h-full min-w-0 flex-1 bg-transparent pr-3 outline-none disabled:opacity-60"
              />
            </div>
            <p className="text-subtle text-xs">Changing the URL breaks links people have saved.</p>
          </div>
          <FieldError>{error}</FieldError>
          {canEdit && (
            <Button type="submit" loading={pending}>
              Save changes
            </Button>
          )}
        </form>
      </Card>

      {isOwner && (
        <Card className="border-danger/40 p-5">
          <h3 className="text-sm font-semibold">Delete workspace</h3>
          <p className="text-muted mt-1 text-sm">
            Permanently deletes every project, task, comment and file. This can&apos;t be undone.
          </p>
          <Button
            variant="danger"
            className="mt-4"
            disabled={isDemo}
            onClick={() => setConfirmOpen(true)}
          >
            Delete workspace
          </Button>
          {isDemo && (
            <p className="text-subtle mt-2 text-xs">The demo workspace can&apos;t be deleted.</p>
          )}
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent size="sm">
              <DialogHeader>
                <DialogTitle>Delete {name}?</DialogTitle>
                <DialogDescription>
                  Type the workspace name to confirm. Everyone loses access immediately.
                </DialogDescription>
              </DialogHeader>
              <DialogBody className="space-y-2">
                <Input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  aria-label="Workspace name"
                  placeholder={name}
                />
                <FieldError>{deleteError}</FieldError>
              </DialogBody>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  disabled={confirm !== name}
                  loading={deleting}
                  onClick={() =>
                    startDelete(async () => {
                      const res = await deleteWorkspace({ slug, confirm });
                      if (res && !res.ok) setDeleteError(res.error);
                    })
                  }
                >
                  Delete forever
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Card>
      )}
    </div>
  );
}

const TONES: BadgeTone[] = [
  "neutral",
  "accent",
  "info",
  "success",
  "warning",
  "danger",
  "violet",
  "pink",
];

function LabelDialog({
  slug,
  label,
  open,
  onOpenChange,
}: {
  slug: string;
  label?: { id: string; name: string; tone: string };
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [name, setName] = useState(label?.name ?? "");
  const [tone, setTone] = useState(label?.tone ?? "info");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form
          action={() =>
            start(async () => {
              const res = await saveLabel({ slug, id: label?.id, name, tone });
              if (!res.ok) return setError(res.error);
              toast.success(label ? "Label updated" : "Label created");
              onOpenChange(false);
              if (!label) setName("");
            })
          }
        >
          <DialogHeader>
            <DialogTitle>{label ? "Edit label" : "New label"}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="label-name">Name</Label>
              <Input
                id="label-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <fieldset>
              <legend className="text-fg-2 mb-2 text-[13px] font-medium">Color</legend>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    aria-pressed={tone === t}
                    className={cn(
                      "rounded-full p-0.5 ring-offset-2 ring-offset-[var(--surface)]",
                      tone === t && "ring-accent ring-2",
                    )}
                  >
                    <Badge tone={t} shape="tag" className="capitalize">
                      {name || t}
                    </Badge>
                  </button>
                ))}
              </div>
            </fieldset>
            <FieldError>{error}</FieldError>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!name.trim()}>
              Save label
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LabelsManager({
  slug,
  labels,
  counts,
  canEdit,
}: {
  slug: string;
  labels: { id: string; name: string; tone: string }[];
  counts: Record<string, number>;
  canEdit: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      {canEdit && (
        <div className="mb-3 flex justify-end">
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus /> New label
          </Button>
        </div>
      )}
      <Card className="divide-border-subtle divide-y p-0">
        {labels.length === 0 && <p className="text-subtle p-5 text-sm">No labels yet.</p>}
        {labels.map((l) => (
          <div key={l.id} className="flex items-center gap-3 px-4 py-3">
            <Badge tone={l.tone as BadgeTone} shape="tag">
              {l.name}
            </Badge>
            <span className="text-subtle text-xs">{plural(counts[l.id] ?? 0, "task")}</span>
            {canEdit && (
              <span className="ml-auto flex gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${l.name}`}
                  onClick={() => setEditing(l.id)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${l.name}`}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await deleteLabel({ slug, id: l.id });
                      if (!res.ok) toast.error(res.error);
                      else toast.success(`Deleted ${l.name}`);
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </span>
            )}
            {editing === l.id && (
              <LabelDialog
                key={l.id}
                slug={slug}
                label={l}
                open
                onOpenChange={(o) => !o && setEditing(null)}
              />
            )}
          </div>
        ))}
      </Card>
      <LabelDialog slug={slug} open={creating} onOpenChange={setCreating} />
    </>
  );
}

export function ProfileForm({
  slug,
  name,
  email,
  isDemo,
}: {
  slug: string;
  name: string;
  email: string;
  isDemo: boolean;
}) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <Card className="p-5">
      <form
        className="space-y-4"
        action={(form) =>
          start(async () => {
            const res = await updateProfile({ slug, fullName: String(form.get("name")) });
            if (!res.ok) return setError(res.error);
            setError(undefined);
            toast.success("Profile updated");
          })
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="profile-name">Full name</Label>
          <Input id="profile-name" name="name" defaultValue={name} disabled={isDemo} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-email">Email</Label>
          <Input id="profile-email" value={email} disabled readOnly />
        </div>
        <FieldError>
          {error ?? (isDemo ? "The demo account's profile can't be changed." : undefined)}
        </FieldError>
        {!isDemo && (
          <Button type="submit" loading={pending}>
            Save profile
          </Button>
        )}
      </form>
    </Card>
  );
}
