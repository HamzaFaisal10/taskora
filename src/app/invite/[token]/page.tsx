import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/workspace";
import { AcceptButton } from "./accept-button";

export const metadata: Metadata = { title: "Join workspace" };

type Preview = {
  status: "ok" | "member" | "used" | "expired" | "wrong_email" | "invalid";
  workspace?: string;
  slug?: string | null;
  inviter?: string | null;
  role?: string;
  email?: string;
};

async function accept(form: FormData) {
  "use server";
  const token = String(form.get("token"));
  const supabase = await createClient();
  const { data: workspaceId, error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error)
    redirect(
      `/invite/${token}?error=${error.message.includes("WRONG_EMAIL") ? "email" : "invalid"}`,
    );
  const { data } = await supabase.from("workspaces").select("slug").eq("id", workspaceId).single();
  redirect(data ? `/w/${data.slug}` : "/app");
}

/** Sign out here, then sign in (or sign up) with the address the invite was sent to. */
async function switchAccount(form: FormData) {
  "use server";
  const token = String(form.get("token"));
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
}

const ROLE_TEXT: Record<string, string> = {
  admin: "an admin",
  member: "a member",
  guest: "a guest",
};

export default async function InvitePage({ params, searchParams }: PageProps<"/invite/[token]">) {
  const [{ token }, { error }, viewer] = await Promise.all([params, searchParams, requireViewer()]);
  const supabase = await createClient();
  const { data } = await supabase.rpc("invite_preview", { p_token: token });
  const invite = (data as Preview | null) ?? { status: "invalid" };
  const status = error === "email" ? "wrong_email" : invite.status;
  const where = invite.workspace ? (
    <span className="text-fg">{invite.workspace}</span>
  ) : (
    "the workspace"
  );

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-[400px] space-y-6 text-center">
        <Logo size={28} className="justify-center" />

        {status === "ok" && (
          <>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Join {invite.workspace}</h1>
              <p className="text-muted mt-1.5 text-sm">
                {invite.inviter ? `${invite.inviter} invited you` : "You've been invited"} to join
                as {ROLE_TEXT[invite.role ?? "member"] ?? "a member"}. You&apos;re signed in as{" "}
                <span className="text-fg">{viewer.email}</span>.
              </p>
            </div>
            {error && (
              <p role="alert" className="bg-danger-soft text-danger-text rounded-card p-3 text-sm">
                Couldn&apos;t accept the invite. Try again, or ask for a new link.
              </p>
            )}
            <form action={accept}>
              <input type="hidden" name="token" value={token} />
              <AcceptButton />
            </form>
          </>
        )}

        {status === "member" && (
          <>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">You&apos;re already in</h1>
              <p className="text-muted mt-1.5 text-sm">You&apos;re a member of {where}.</p>
            </div>
            <Button asChild size="lg" className="w-full">
              <Link href={invite.slug ? `/w/${invite.slug}` : "/app"}>Open {invite.workspace}</Link>
            </Button>
          </>
        )}

        {status === "wrong_email" && (
          <>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                This invite is for someone else
              </h1>
              <p className="text-muted mt-1.5 text-sm">
                It was sent to <span className="text-fg">{invite.email}</span>, but you&apos;re
                signed in as <span className="text-fg">{viewer.email}</span>. Sign in with the
                invited address to join {where}.
              </p>
            </div>
            <form action={switchAccount}>
              <input type="hidden" name="token" value={token} />
              <Button type="submit" size="lg" className="w-full">
                Sign in with another account
              </Button>
            </form>
          </>
        )}

        {(status === "used" || status === "expired" || status === "invalid") && (
          <>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {status === "expired" ? "This invite has expired" : "This invite link doesn't work"}
              </h1>
              <p className="text-muted mt-1.5 text-sm">
                {status === "used"
                  ? "It has already been used. "
                  : status === "invalid"
                    ? "It may have been cancelled, or the link is incomplete. "
                    : "Invites last 7 days. "}
                Ask {invite.inviter ?? "the person who invited you"} to send a new one.
              </p>
            </div>
            <Button asChild variant="secondary" size="lg" className="w-full">
              <Link href="/app">Go to Taskora</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
