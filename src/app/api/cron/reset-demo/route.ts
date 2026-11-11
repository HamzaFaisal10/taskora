import { cleanKey, safeError } from "@/lib/env";
import { NextResponse, type NextRequest } from "next/server";
import { resetDemo } from "@/lib/demo";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Nightly demo reset, called by Vercel Cron (see vercel.json) and by the GitHub
 * keep-alive workflow. Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const secret = cleanKey(process.env.CRON_SECRET);
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const workspaceId = await resetDemo();
    // Daily "due in N days" automation rules for every workspace.
    const { data: automationRuns, error } = await createAdminClient().rpc(
      "run_scheduled_automations",
    );
    if (error) throw error;
    return NextResponse.json({ ok: true, workspaceId, automationRuns });
  } catch (error) {
    console.error("Demo reset failed", safeError(error));
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
