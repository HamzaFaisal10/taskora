import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cleanKey, supabaseEnv } from "@/lib/env";

/**
 * Service-role client. Bypasses row level security, so it is only used for the
 * few jobs that need it (demo sign-in, nightly demo reset) and never reaches the browser.
 */
export function createAdminClient() {
  const serviceKey = cleanKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(supabaseEnv().url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
