"use client";

import { Copy, MoreHorizontal, UserPlus } from "lucide-react";
import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { Card } from "@/components/ui/surface";
import type { Role } from "@/lib/workspace";
import { changeRole, createInvite, removeMember, revokeInvite, type InviteState } from "./actions";

export type Member = {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  role: Role;
};
export type Invite = { id: string; email: string; role: Role; expiresAt: string };

const ROLE_TONE = { owner: "solid", admin: "accent", member: "neutral", guest: "violet" } as const;
const ROLE_HELP = {
  admin: "Manages members, billing and settings",
  member: "Creates and edits work",
  guest: "Sees only shared projects",
} as const;

export function InviteForm({ slug, disabled }: { slug: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(
    createInvite.bind(null, slug),
    undefined,
  );
  return (
    <Card className="p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <UserPlus className="size-4" aria-hidden /> Invite people
      </h2>
      <form
        action={action}
        className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_auto] sm:items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            placeholder="teammate@company.com"
            disabled={disabled}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-role">Role</Label>
          <select
            id="invite-role"
            name="role"
            defaultValue="member"
            disabled={disabled}
            className="border-border bg-card rounded-control h-10 w-full border px-2.5 text-sm"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="guest">Guest</option>
          </select>
        </div>
        <Button type="submit" size="lg" loading={pending} disabled={disabled}>
          Create invite
        </Button>
      </form>
      <div className="mt-3">
        <FieldError>
          {state?.error ?? (disabled ? "Invites are turned off in the demo workspace." : undefined)}
        </FieldError>
        {state?.link && (
          <div className="bg-success-soft text-success-text rounded-card mt-1 flex flex-wrap items-center gap-2 p-3 text-sm">
            <span className="min-w-0 flex-1">
              Invite ready for {state.email}. Send them this link:
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                const url = state.link!.startsWith("http")
                  ? state.link!
                  : `${location.origin}${state.link}`;
                navigator.clipboard.writeText(url).then(() => toast.success("Invite link copied"));
              }}
            >
              <Copy /> Copy link
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

export function MemberRow({
  slug,
  member,
  canEdit,
  isSelf,
}: {
  slug: string;
  member: Member;
  canEdit: boolean;
  isSelf: boolean;
}) {
  const [pending, start] = useTransition();
  const editable = canEdit && member.role !== "owner" && !isSelf;
  return (
    <li
      className="border-border-subtle flex items-center gap-3 border-b px-4 py-3 last:border-0 sm:px-5"
      aria-busy={pending}
    >
      <Avatar name={member.name} src={member.avatarUrl} seed={member.id} size={32} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {member.name}
          {isSelf && <span className="text-subtle font-normal"> (you)</span>}
        </p>
        {member.email && <p className="text-subtle truncate text-xs">{member.email}</p>}
      </div>
      <Badge tone={ROLE_TONE[member.role]} className="capitalize">
        {member.role}
      </Badge>
      {editable ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Manage ${member.name}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Change role</DropdownMenuLabel>
            {(["admin", "member", "guest"] as const).map((r) => (
              <DropdownMenuItem
                key={r}
                disabled={r === member.role}
                onSelect={() => start(() => changeRole(slug, member.id, r))}
              >
                <span className="flex flex-col">
                  <span className="capitalize">{r}</span>
                  <span className="text-subtle text-[11px]">{ROLE_HELP[r]}</span>
                </span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              onSelect={() => start(() => removeMember(slug, member.id))}
            >
              Remove from workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="size-8" aria-hidden />
      )}
    </li>
  );
}

export function InviteRow({
  slug,
  invite,
  canEdit,
}: {
  slug: string;
  invite: Invite;
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <li className="border-border-subtle flex items-center gap-3 border-b px-4 py-3 last:border-0 sm:px-5">
      <span className="border-border size-8 rounded-full border border-dashed" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{invite.email}</p>
        <p className="text-subtle text-xs">
          Invited · expires {new Date(invite.expiresAt).toLocaleDateString()}
        </p>
      </div>
      <Badge tone="warning" className="capitalize">
        {invite.role}
      </Badge>
      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          loading={pending}
          onClick={() => start(() => revokeInvite(slug, invite.id))}
        >
          Revoke
        </Button>
      )}
    </li>
  );
}
