/** Public Supabase settings. Both are safe to expose in the browser. */
/** Keys never contain whitespace, so strip any that sneaks in when pasting into a dashboard. */
export const cleanKey = (value: string | undefined) => value?.replace(/\s+/g, "") || undefined;

export function supabaseEnv() {
  const url = cleanKey(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = cleanKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local.",
    );
  }
  return { url, anonKey };
}

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const demoEmail = () =>
  (process.env.DEMO_USER_EMAIL ?? "demo@taskora.example").toLowerCase();

/** Error details that are safe to log: never the message, which can echo request headers. */
export function safeError(error: unknown) {
  if (error && typeof error === "object") {
    const e = error as { name?: string; code?: string; status?: number };
    return { name: e.name, code: e.code, status: e.status };
  }
  return { name: typeof error };
}
