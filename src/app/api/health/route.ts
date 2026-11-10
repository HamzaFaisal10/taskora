import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Lightweight check that the app can reach the database. Also keeps the free Supabase project active. */
export async function GET() {
  try {
    const { error } = await createAdminClient()
      .from("workspaces")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
