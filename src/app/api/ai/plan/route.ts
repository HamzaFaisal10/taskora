import { NextResponse } from "next/server";
import { planTasks } from "@/lib/ai/plan-run";

export const dynamic = "force-dynamic";

/** Drafts tasks from a brief. Input is validated in planTasks; credits are charged in the database. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const res = await planTasks(body);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
