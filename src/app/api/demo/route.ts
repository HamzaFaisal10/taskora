import { safeError } from "@/lib/env";
import { NextResponse, type NextRequest } from "next/server";
import { createDemoSignInToken } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";

/** "Try the demo": signs the visitor in to the shared demo workspace without a password. */
export async function POST(request: NextRequest) {
  const origin = request.nextUrl.origin;
  try {
    const supabase = await createClient();
    // Local only: a global sign-out would end every other visitor's demo session too.
    await supabase.auth.signOut({ scope: "local" });
    const tokenHash = await createDemoSignInToken();
    const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });
    if (error) throw error;
    return NextResponse.redirect(`${origin}/w/demo`, { status: 303 });
  } catch (error) {
    console.error("Demo sign-in failed", safeError(error));
    return NextResponse.redirect(`${origin}/login?error=demo`, { status: 303 });
  }
}
