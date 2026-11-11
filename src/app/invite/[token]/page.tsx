import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/workspace";
import { AcceptButton } from "./accept-button";

export const metadata: Metadata = { title: "Join workspace" };

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

export default async function InvitePage({ params, searchParams }: PageProps<"/invite/[token]">) {
  const [{ token }, { error }, viewer] = await Promise.all([params, searchParams, requireViewer()]);
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-[380px] space-y-6 text-center">
        <Logo size={28} className="justify-center" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">You’ve been invited</h1>
          <p className="text-muted mt-1.5 text-sm">
            Join the workspace as <span className="text-fg">{viewer.email}</span>.
          </p>
        </div>
        {error && (
          <p role="alert" className="bg-danger-soft text-danger-text rounded-card p-3 text-sm">
            {error === "email"
              ? "This invite was sent to a different email address. Sign in with that address to accept it."
              : "This invite link has expired or was already used. Ask for a new one."}
          </p>
        )}
        <form action={accept}>
          <input type="hidden" name="token" value={token} />
          <AcceptButton />
        </form>
      </div>
    </main>
  );
}
