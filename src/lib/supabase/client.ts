"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient> | undefined;

/** Supabase client for client components. Acts as the signed-in user. */
export function createClient() {
  if (!client) {
    const { url, anonKey } = supabaseEnv();
    client = createBrowserClient(url, anonKey);
  }
  return client;
}
