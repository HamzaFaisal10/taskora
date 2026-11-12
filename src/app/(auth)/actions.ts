"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type AuthState =
  { error?: string; message?: string; fields?: Record<string, string> } | undefined;

const email = z.string().trim().toLowerCase().email("Enter a valid email address.");
const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.");

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;
}

function friendly(message: string) {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match.";
  if (/email not confirmed/i.test(message))
    return "Confirm your email first. Check your inbox for the link.";
  if (/rate limit/i.test(message)) return "Too many attempts. Wait a minute and try again.";
  if (/already registered/i.test(message))
    return "An account with this email already exists. Sign in instead.";
  return "Something went wrong. Please try again.";
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z
    .object({ email, password: z.string().min(1, "Enter your password.") })
    .safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });
  const fields = { email: String(form.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: friendly(error.message), fields };
  redirect(safeNext(String(form.get("next") ?? "")));
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = z
    .object({ name: z.string().trim().min(1, "Enter your name.").max(120), email, password })
    .safeParse({
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
    });
  const fields = { name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };

  const next = safeNext(String(form.get("next") ?? ""), "/onboarding");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.name },
      emailRedirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: friendly(error.message), fields };
  // With email confirmation on, Supabase returns no session until the link is clicked.
  if (!data.session) {
    return {
      message: `We sent a confirmation link to ${parsed.data.email}. Open it to finish signing up.`,
    };
  }
  redirect(next);
}

export async function sendResetLink(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = email.safeParse(form.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await origin()}/auth/callback?next=/reset-password`,
  });
  // Same answer whether or not the account exists, so emails can't be probed.
  return { message: "If an account exists for that email, a reset link is on its way." };
}

export async function updatePassword(_: AuthState, form: FormData): Promise<AuthState> {
  const parsed = password.safeParse(form.get("password"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (parsed.data !== form.get("confirm")) return { error: "The passwords don't match." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { error: "This reset link has expired. Request a new one." };
  redirect("/app");
}

export async function signOut() {
  const supabase = await createClient();
  // Signs out this browser only; the shared demo account stays signed in for other visitors.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

/** From the shared demo account to the sign-up page (signs this browser out of the demo first). */
export async function leaveDemoToSignUp() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/signup");
}
