import { NextResponse } from "next/server";
import { loadTaskDetail } from "@/lib/project/task-detail";

export const dynamic = "force-dynamic";

/**
 * Task detail for the side panel. A plain GET (not a server action) so it runs in parallel with
 * edits instead of waiting in the server-action queue. Row level security decides what is visible.
 */
export async function GET(_: Request, ctx: RouteContext<"/api/tasks/[projectId]/[number]">) {
  const { projectId, number } = await ctx.params;
  const res = await loadTaskDetail(projectId, Number(number));
  return NextResponse.json(res, {
    status: res.ok ? 200 : 404,
    headers: { "cache-control": "no-store" },
  });
}
