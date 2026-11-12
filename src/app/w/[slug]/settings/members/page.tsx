import type { Metadata } from "next";
import { SettingsSection } from "@/components/settings/section";
import { Card } from "@/components/ui/surface";
import { createClient } from "@/lib/supabase/server";
import { canManage, getWorkspaceContext, type Role } from "@/lib/workspace";
import { InviteForm, InviteRow, MemberRow, type Invite, type Member } from "./members-view";

export const metadata: Metadata = { title: "Members" };

const ROLE_ORDER: Record<Role, number> = { owner: 0, admin: 1, member: 2, guest: 3 };
const LIMITS = { free: 5, pro: 25, business: null } as const;

export default async function MembersPage({ params }: PageProps<"/w/[slug]/settings/members">) {
  const { slug } = await params;
  const { workspace, viewer } = await getWorkspaceContext(slug);
  const supabase = await createClient();
  const admin = canManage(workspace.role);

  const [{ data: memberRows }, { data: inviteRows }] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("role, profiles!inner(id, full_name, email, avatar_url)")
      .eq("workspace_id", workspace.id),
    admin
      ? supabase
          .from("workspace_invites")
          .select("id, email, role, expires_at")
          .eq("workspace_id", workspace.id)
          .is("accepted_at", null)
          .gt("expires_at", new Date().toISOString())
      : Promise.resolve({ data: [] }),
  ]);

  type M = {
    role: Role;
    profiles: { id: string; full_name: string; email: string | null; avatar_url: string | null };
  };
  const members: Member[] = ((memberRows ?? []) as unknown as M[])
    .map((m) => ({
      id: m.profiles.id,
      name: m.profiles.full_name || m.profiles.email || "Unnamed",
      email: m.profiles.email,
      avatarUrl: m.profiles.avatar_url,
      role: m.role,
    }))
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name));
  const invites: Invite[] = (
    (inviteRows ?? []) as { id: string; email: string; role: Role; expires_at: string }[]
  ).map((i) => ({ id: i.id, email: i.email, role: i.role, expiresAt: i.expires_at }));
  const limit = LIMITS[workspace.plan];
  const seats = members.filter((m) => m.role !== "guest").length;

  return (
    <>
      <SettingsSection
        title="Members"
        description={
          limit
            ? `${seats} of ${limit} seats used on the ${workspace.plan === "free" ? "Free" : "Pro"} plan. Guests don’t use a seat.`
            : `${seats} ${seats === 1 ? "member" : "members"}. Guests don’t use a seat.`
        }
      />
      <div className="space-y-6">
        {admin && <InviteForm slug={slug} disabled={workspace.isDemo} />}
        <Card className="overflow-hidden p-0">
          <ul>
            {members.map((m) => (
              <MemberRow
                key={m.id}
                slug={slug}
                member={m}
                canEdit={admin}
                isSelf={m.id === viewer.id}
              />
            ))}
          </ul>
        </Card>
        {invites.length > 0 && (
          <section>
            <h2 className="mb-2 text-[13px] font-medium">Pending invites</h2>
            <Card className="overflow-hidden p-0">
              <ul>
                {invites.map((i) => (
                  <InviteRow key={i.id} slug={slug} invite={i} canEdit={admin} />
                ))}
              </ul>
            </Card>
          </section>
        )}
      </div>
    </>
  );
}
