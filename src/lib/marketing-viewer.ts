import "server-only";
import { demoEmail, isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Who is looking at a public page: nobody signed in, the shared demo visitor, or someone's own account. */
export type MarketingViewer = "out" | "demo" | "user";

export async function marketingViewer(): Promise<MarketingViewer> {
  if (!isSupabaseConfigured()) return "out";
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (!claims?.sub) return "out";
    return String(claims.email ?? "").toLowerCase() === demoEmail() ? "demo" : "user";
  } catch {
    return "out";
  }
}
