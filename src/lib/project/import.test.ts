import { describe, expect, it } from "vitest";
import { mapImport, parseDate } from "./import";

const ctx = {
  statuses: [
    { id: "s-todo", name: "To do", category: "unstarted" },
    { id: "s-doing", name: "Doing", category: "started" },
    { id: "s-done", name: "Done", category: "completed" },
  ],
  people: [
    { id: "u-sara", name: "Sara Rehman", email: "sara@x.io" },
    { id: "u-sam", name: "Sam Lee" },
    { id: "u-zain", name: "Zain Malik" },
  ],
  labels: [
    { id: "l-be", name: "Backend" },
    { id: "l-bug", name: "Bug" },
  ],
};

describe("csv import mapping", () => {
  it("maps loose headers, names, labels, dates and priorities", () => {
    const r = mapImport(
      [
        ["Task name", "Owner", "State", "Priority", "Deadline", "Story points", "Tags", "Notes"],
        ["Fix login", "sara@x.io", "doing", "P1", "20/11/2026", "3", "Bug; backend", "Steps…"],
        ["Write docs", "Zain", "In progress", "", "Nov 25, 2026", "", "", ""],
      ],
      ctx,
    );
    expect(r.columns).toMatchObject({
      title: "Task name",
      assignee: "Owner",
      status: "State",
      due: "Deadline",
    });
    expect(r.tasks[0]).toEqual({
      title: "Fix login",
      description: "Steps…",
      statusId: "s-doing",
      priority: "high",
      assigneeId: "u-sara",
      dueDate: "2026-11-20",
      estimate: 3,
      labelIds: ["l-bug", "l-be"],
    });
    // "In progress" isn't a column name, but it's the "started" stage from Taskora's own export.
    expect(r.tasks[1]).toMatchObject({
      statusId: "s-doing",
      assigneeId: "u-zain",
      dueDate: "2026-11-25",
    });
    expect(r.warnings).toEqual([]);
  });

  it("reports what it couldn't match instead of guessing", () => {
    const r = mapImport(
      [
        ["Title", "Assignee", "Status", "Labels", "Due"],
        ["A", "Sa", "Blocked", "Design", "someday"],
        ["", "", "", "", ""],
        ["B", "S", "", "", ""],
      ],
      ctx,
    );
    expect(r.tasks.map((t) => [t.title, t.assigneeId, t.statusId])).toEqual([
      ["A", null, null],
      ["B", null, null],
    ]);
    expect(r.warnings.join(" ")).toMatch(/Unknown status “Blocked”/);
    expect(r.warnings.join(" ")).toMatch(/No member named “Sa”, “S”/);
    expect(r.warnings.join(" ")).toMatch(/No label “Design”/);
    expect(r.warnings.join(" ")).toMatch(/1 due date couldn't be read/);
  });

  it("needs a title column", () => {
    expect(mapImport([["Foo"], ["bar"]], ctx).warnings[0]).toMatch(/No title column/);
  });

  it("reads common date formats and rejects impossible dates", () => {
    expect(parseDate("2026-02-03")).toBe("2026-02-03");
    expect(parseDate("03/02/2026")).toBe("2026-02-03");
    expect(parseDate("12/31/2026")).toBe("2026-12-31");
    expect(parseDate("5 Mar 2026")).toBe("2026-03-05");
    expect(parseDate("2026-02-30")).toBeNull();
    expect(parseDate("tomorrow")).toBeNull();
  });
});
