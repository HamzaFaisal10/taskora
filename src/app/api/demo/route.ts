import { safeError } from "@/lib/env";
import { NextResponse, type NextRequest } from "next/server";
import { createDemoSignInToken } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";

/** Only pages inside the demo workspace may be opened after signing in to the demo. */
function demoPath(next: unknown) {
  const path = typeof next === "string" ? next : "";
  return path === "/w/demo" || path.startsWith("/w/demo/") || path.startsWith("/w/demo?")
    ? path
    : "/w/demo";
}

async function signInToDemo(request: NextRequest, next: string, marker = false) {
  const origin = request.nextUrl.origin;
  try {
    const supabase = await createClient();
    // Local only: a global sign-out would end every other visitor's demo session too.
    await supabase.auth.signOut({ scope: "local" });
    const tokenHash = await createDemoSignInToken();
    const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });
    if (error) throw error;
    const to = new URL(next, origin);
    // Lets the proxy tell "the session cookie didn't stick" from a first visit, so it can't loop.
    if (marker) to.searchParams.set("demo", "1");
    return NextResponse.redirect(to, { status: 303 });
  } catch (error) {
    console.error("Demo sign-in failed", safeError(error));
    return NextResponse.redirect(`${origin}/login?error=demo`, { status: 303 });
  }
}

/** "Try the demo": signs the visitor in to the shared demo workspace without a password. */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  return signInToDemo(request, demoPath(form?.get("next")));
}

/**
 * A shared link into the demo workspace, opened by someone who isn't signed in: sign them in as the
 * demo visitor and continue to the link. Someone already signed in is never signed out here.
 */
export async function GET(request: NextRequest) {
  const next = demoPath(request.nextUrl.searchParams.get("next"));
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) return NextResponse.redirect(new URL(next, request.nextUrl.origin));
  return signInToDemo(request, next, true);
}
