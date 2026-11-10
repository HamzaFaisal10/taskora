import { NextResponse, type NextRequest } from "next/server";
import { resetDemo } from "@/lib/demo";

/**
 * Nightly demo reset, called by Vercel Cron (see vercel.json) and by the GitHub
 * keep-alive workflow. Vercel sends `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const workspaceId = await resetDemo();
    return NextResponse.json({ ok: true, workspaceId });
  } catch (error) {
    console.error("Demo reset failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
