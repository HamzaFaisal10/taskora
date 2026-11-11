import { describe, expect, it } from "vitest";
import { draftUpdate, projectFacts, type SnapshotTask } from "./status-update";

const t = (o: Partial<SnapshotTask> & { ref: string }): SnapshotTask => ({
  title: o.ref.toLowerCase(),
  open: true,
  priority: "medium",
  dueDate: null,
  completedAt: null,
  estimate: 2,
  inSprint: false,
  openBlockers: [],
  ...o,
});

describe("status update drafter", () => {
  it("is on track when nothing is late and the sprint is on pace", () => {
    const d = draftUpdate({
      today: "2026-11-11",
      sprint: { name: "Sprint 12", startDate: "2026-11-04", endDate: "2026-11-18" },
      tasks: [
        t({ ref: "A-1", open: false, completedAt: "2026-11-10T10:00:00Z", inSprint: true }),
        t({ ref: "A-2", open: false, completedAt: "2026-11-09T10:00:00Z", inSprint: true }),
        t({ ref: "A-3", inSprint: true, dueDate: "2026-11-14" }),
        t({ ref: "A-4", inSprint: true }),
        t({ ref: "A-5", open: false, completedAt: "2026-10-01T10:00:00Z" }),
      ],
    });
    expect(d.health).toBe("on_track");
    expect(d.body).toContain(
      "**On track.** Finished 2 tasks this week, including A-1 a-1 and A-2 a-2.",
    );
    expect(d.body).toContain("**Sprint 12:** 4 of 8 points done with 7 days left.");
    expect(d.body).toContain("**Risks:** nothing overdue or blocked.");
    expect(d.body).toContain("**Next up:** A-3 a-3 (Nov 14).");
  });

  it("flags overdue and blocked work", () => {
    const d = draftUpdate({
      today: "2026-11-11",
      sprint: null,
      tasks: [
        t({ ref: "B-1", dueDate: "2026-11-09", title: "Stripe webhooks" }),
        t({ ref: "B-2", priority: "high", openBlockers: ["B-1"], title: "Billing page" }),
      ],
    });
    expect(d.health).toBe("at_risk");
    expect(d.body).toContain("Nothing was finished in the last 7 days.");
    expect(d.body).toContain(
      "B-1 Stripe webhooks is overdue (due Nov 9). B-2 Billing page is waiting on B-1.",
    );
  });

  it("is off track when the sprint is far behind", () => {
    const f = projectFacts({
      today: "2026-11-16",
      sprint: { name: "S", startDate: "2026-11-04", endDate: "2026-11-18" },
      tasks: [t({ ref: "C-1", inSprint: true }), t({ ref: "C-2", inSprint: true })],
    });
    expect(f.sprint?.workShare).toBe(0);
    expect(f.health).toBe("off_track");
  });
});
