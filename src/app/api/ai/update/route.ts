import { NextResponse } from "next/server";
import { draftProjectUpdate } from "@/lib/ai/update-run";

export const dynamic = "force-dynamic";

/** Drafts a project status update. Credits are charged in the database. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const res = await draftProjectUpdate(body);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
