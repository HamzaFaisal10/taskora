import { describe, expect, it } from "vitest";
import { byProject, kpis, median, weekly, workload, type AnalyticsTask } from "./compute";

const now = new Date("2026-11-11T12:00:00Z");
const t = (over: Partial<AnalyticsTask>): AnalyticsTask => ({
  id: Math.random().toString(36),
  projectId: "p1",
  assigneeId: "a",
  createdAt: "2026-11-01T09:00:00Z",
  completedAt: null,
  dueDate: null,
  estimate: null,
  category: "started",
  ...over,
});

describe("analytics", () => {
  it("computes a median", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("buckets created and completed work by Monday weeks", () => {
    const pts = weekly(
      [
        t({
          createdAt: "2026-11-09T10:00:00Z",
          completedAt: "2026-11-10T10:00:00Z",
          category: "completed",
        }),
        t({ createdAt: "2026-11-02T10:00:00Z" }),
        t({
          createdAt: "2026-10-01T10:00:00Z",
          completedAt: "2026-11-03T10:00:00Z",
          category: "completed",
        }),
        t({
          createdAt: "2026-11-09T10:00:00Z",
          completedAt: "2026-11-10T10:00:00Z",
          category: "canceled",
        }),
      ],
      2,
      now,
    );
    expect(pts.map((p) => p.start)).toEqual(["2026-11-02", "2026-11-09"]);
    expect(pts[0]).toMatchObject({ created: 1, completed: 1 });
    expect(pts[1]).toMatchObject({ created: 2, completed: 1 });
  });

  it("compares the last 30 days with the 30 before and counts overdue open work", () => {
    const k = kpis(
      [
        t({
          createdAt: "2026-11-01T00:00:00Z",
          completedAt: "2026-11-03T00:00:00Z",
          category: "completed",
        }),
        t({
          createdAt: "2026-11-01T00:00:00Z",
          completedAt: "2026-11-05T00:00:00Z",
          category: "completed",
        }),
        t({
          createdAt: "2026-09-20T00:00:00Z",
          completedAt: "2026-10-01T00:00:00Z",
          category: "completed",
        }),
        t({ dueDate: "2026-11-10" }),
        t({ dueDate: "2026-11-11" }),
      ],
      30,
      now,
    );
    expect(k).toEqual({
      completed: 2,
      completedBefore: 1,
      cycleDays: 3,
      cycleDaysBefore: 11,
      open: 2,
      overdue: 1,
    });
  });

  it("sums open work per person, busiest first", () => {
    const w = workload(
      [
        t({ assigneeId: "a", estimate: 3 }),
        t({ assigneeId: "b" }),
        t({ assigneeId: "b", dueDate: "2026-11-01" }),
        t({ assigneeId: "a", category: "completed" }),
      ],
      now,
    );
    expect(w[0]).toEqual({ personId: "b", open: 2, overdue: 1, points: 2 });
    expect(w[1]).toEqual({ personId: "a", open: 1, overdue: 0, points: 3 });
  });

  it("ignores canceled tasks in project progress", () => {
    const [p] = byProject(
      [
        t({ category: "completed", completedAt: "2026-11-05T00:00:00Z" }),
        t({}),
        t({ category: "canceled" }),
      ],
      30,
      now,
    );
    expect(p).toMatchObject({ total: 2, open: 1, done: 1, completedRecent: 1 });
  });
});

describe("byStatus", () => {
  it("counts per stage in workflow order and skips empty stages", async () => {
    const { byStatus } = await import("./compute");
    const t = (category: string) => ({
      id: category + Math.random(),
      projectId: "p",
      assigneeId: null,
      createdAt: "2026-11-01T00:00:00Z",
      completedAt: null,
      dueDate: null,
      estimate: null,
      category,
    });
    const rows = byStatus([t("completed"), t("started"), t("completed"), t("backlog")]);
    expect(rows.map((r) => [r.label, r.count])).toEqual([
      ["Backlog", 1],
      ["In progress", 1],
      ["Done", 2],
    ]);
    expect(rows[2].share).toBe(0.5);
  });
});
