"use client";

import { Copy, Loader2, UserPlus, Users, X } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError, Input, Label } from "@/components/ui/input";
import {
  getProjectAccess,
  inviteGuestToProject,
  shareWithGuest,
  unshareWithGuest,
  type ProjectAccess,
} from "@/lib/project/share-actions";
import { useProject } from "./store";

const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`;

function copy(token: string) {
  navigator.clipboard
    .writeText(inviteUrl(token))
    .then(() => toast.success("Invite link copied"))
    .catch(() => toast.error("Couldn't copy. Select the link and copy it instead."));
}

/**
 * Share a project with guests (clients, freelancers). Members see every project; guests see only the
 * projects shared with them, can comment, and can't change tasks.
 */
export function ShareDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { project } = useProject();
  const [access, setAccess] = useState<ProjectAccess | null>(null);
  const [error, setError] = useState<string>();
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [inviting, startInvite] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getProjectAccess(project.id);
    if (res.ok) setAccess(res.data);
    else setError(res.error);
  }, [project.id]);

  // The dialog is mounted only while open, so load once on mount (state is set when the reply arrives).
  useEffect(() => {
    let alive = true;
    getProjectAccess(project.id).then((res) => {
      if (!alive) return;
      if (res.ok) setAccess(res.data);
      else setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [project.id]);

  const toggle = async (userId: string, share: boolean) => {
    setBusy(userId);
    const res = share
      ? await shareWithGuest({ projectId: project.id, userId })
      : await unshareWithGuest({ projectId: project.id, userId });
    setBusy(null);
    if (!res.ok) return void toast.error(res.error);
    toast.success(share ? "Shared" : "Access removed");
    await load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Share {project.name}</DialogTitle>
          <DialogDescription>
            Everyone who is a member of the workspace can see this project. Guests, such as clients
            or freelancers, see only the projects you share with them. They can comment but
            can&apos;t change tasks.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-6">
          <form
            className="space-y-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              setLink(null);
              startInvite(async () => {
                const res = await inviteGuestToProject({ projectId: project.id, email });
                if (!res.ok) return setError(res.error);
                setError(undefined);
                if (res.data.kind === "shared") {
                  toast.success(`Shared with ${email}`);
                  setEmail("");
                } else if (res.data.token) {
                  setLink(res.data.token);
                }
                await load();
              });
            }}
          >
            <Label htmlFor="share-email">Invite a guest by email</Label>
            <div className="flex gap-2">
              <Input
                id="share-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@company.com"
                required
              />
              <Button type="submit" loading={inviting} disabled={!email.trim()}>
                <UserPlus /> Invite
              </Button>
            </div>
            <FieldError>{error}</FieldError>
            {link && (
              <div className="border-border bg-surface rounded-card mt-2 space-y-2 border p-3">
                <p className="text-sm">
                  Send {email} this link. When they sign up or sign in with that email and accept,
                  they can see this project.
                </p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={inviteUrl(link)}
                    aria-label="Invite link"
                    onFocus={(e) => e.target.select()}
                  />
                  <Button type="button" variant="secondary" onClick={() => copy(link)}>
                    <Copy /> Copy
                  </Button>
                </div>
              </div>
            )}
          </form>

          <section>
            <h3 className="text-fg-2 mb-2 text-[13px] font-medium">People with access</h3>
            {!access ? (
              <p className="text-subtle flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </p>
            ) : (
              <ul className="divide-border-subtle border-border rounded-card divide-y border">
                <li className="flex items-center gap-3 px-3 py-2.5">
                  <span className="bg-elevated grid size-7 place-items-center rounded-full">
                    <Users className="text-muted size-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    All {access.members} workspace members
                  </span>
                  <span className="text-subtle text-xs">Can edit</span>
                </li>
                {access.guests.map((g) => (
                  <li key={g.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Avatar name={g.name} seed={g.id} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{g.name}</span>
                      <span className="text-subtle block truncate text-xs">{g.email}</span>
                    </span>
                    <span className="text-subtle text-xs">Guest · can comment</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${g.name}`}
                      disabled={busy === g.id}
                      onClick={() => toggle(g.id, false)}
                    >
                      <X />
                    </Button>
                  </li>
                ))}
                {access.pending.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Avatar name={i.email} seed={i.email} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{i.email}</span>
                      <span className="text-subtle block text-xs">Invited, not accepted yet</span>
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => copy(i.token)}>
                      <Copy /> Link
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {access && access.otherGuests.length > 0 && (
            <section>
              <h3 className="text-fg-2 mb-2 text-[13px] font-medium">
                Guests in this workspace without access
              </h3>
              <ul className="space-y-1.5">
                {access.otherGuests.map((g) => (
                  <li key={g.id} className="flex items-center gap-3">
                    <Avatar name={g.name} seed={g.id} size={24} />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {g.name} <span className="text-subtle">· {g.email}</span>
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={busy === g.id}
                      onClick={() => toggle(g.id, true)}
                    >
                      Share
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
