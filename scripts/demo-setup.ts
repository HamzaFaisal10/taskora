/**
 * Creates the demo sign-in account (if needed) and rebuilds the demo workspace.
 *
 *   npm run demo:setup
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * The demo account has no password: visitors enter it through the
 * "Try the demo" button, which signs them in on the server.
 * The same reset also runs every night from /api/cron/reset-demo.
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.DEMO_USER_EMAIL ?? "demo@taskora.example").toLowerCase();

async function main() {
  if (!url || !serviceKey) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: "Alex Morgan" },
  });
  if (createError && createError.code !== "email_exists") {
    throw new Error(`Could not create the demo user: ${createError.message}`);
  }
  console.log(createError ? `Demo user ${email} already exists.` : `Created demo user ${email}.`);

  const { data, error } = await supabase.rpc("reset_demo", { p_email: email });
  if (error) throw new Error(`Demo reset failed: ${error.message}`);
  console.log(`Demo workspace ready (${data}).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
