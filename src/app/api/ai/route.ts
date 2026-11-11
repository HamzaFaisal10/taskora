import { NextResponse } from "next/server";
import { askAi } from "@/lib/ai/run";

export const dynamic = "force-dynamic";

/** AI assistant for a task. Input is validated in askAi; credits are charged in the database. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const res = await askAi(body);
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
