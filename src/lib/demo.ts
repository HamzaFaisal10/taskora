import "server-only";
import { demoEmail } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/** Makes sure the passwordless demo account exists, then rebuilds the demo workspace. */
export async function resetDemo() {
  const admin = createAdminClient();
  const email = demoEmail();
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: "Alex Morgan" },
  });
  if (createError && createError.code !== "email_exists") throw createError;

  const { data, error } = await admin.rpc("reset_demo", { p_email: email });
  if (error) throw error;
  return data as string;
}

/** Creates a one-time sign-in token for the demo account (no password involved). */
export async function createDemoSignInToken() {
  const admin = createAdminClient();
  // First visit after a fresh deploy: build the demo account and workspace before signing in.
  const { data: existing } = await admin
    .from("workspaces")
    .select("id")
    .eq("slug", "demo")
    .maybeSingle();
  if (!existing) await resetDemo();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: demoEmail(),
  });
  if (error || !data.properties?.hashed_token) throw error ?? new Error("No demo token returned.");
  return data.properties.hashed_token;
}
