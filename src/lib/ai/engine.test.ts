import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { breakdownTask, summarizeTask, draftDescription } = await import("./engine");

const base = {
  title: "Set up Stripe subscriptions",
  description: "Connect Stripe Checkout for the Pro plan.",
  labels: ["Payments"],
  status: "In progress",
  assignee: "Alex Morgan",
  dueDate: "2026-11-12",
  subtasks: [{ title: "Build the checkout session endpoint", done: true }],
  blockers: [],
  comments: [{ author: "Zain Malik", body: "Staging is missing the test keys." }],
};

describe("demo AI", () => {
  it("picks a playbook from the task and skips subtasks that already exist", async () => {
    const { mode, subtasks } = await breakdownTask(base);
    expect(mode).toBe("demo");
    expect(subtasks.length).toBeGreaterThan(2);
    expect(subtasks.some((s) => /webhook/i.test(s.title))).toBe(true);
    expect(subtasks.some((s) => s.title === "Build the checkout session endpoint")).toBe(false);
  });

  it("summarizes from real task facts in at most three lines", async () => {
    const { lines } = await summarizeTask(base);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines[0]).toContain("Alex Morgan");
    expect(lines[0]).toContain("1 of 1 subtasks done");
    expect(lines.join(" ")).toContain("Zain Malik");
  });

  it("mentions open blockers", async () => {
    const { lines } = await summarizeTask({
      ...base,
      blockers: [{ ref: "MOB-120", title: "Auth", done: false }],
    });
    expect(lines[1]).toContain("MOB-120");
  });

  it("drafts a description with acceptance criteria", async () => {
    const { description } = await draftDescription({
      ...base,
      title: "Crash on Android 14 login",
      labels: ["Bug"],
    });
    expect(description).toMatch(/^Goal: Crash on Android 14 login\./);
    expect(description).toContain("Acceptance criteria:");
    expect(description).toMatch(/Reproduce/);
  });
});
