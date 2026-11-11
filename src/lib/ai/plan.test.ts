import { describe, expect, it } from "vitest";
import { demoPlan } from "./plan";

const BRIEF = `Hi team! We're launching a referral program in March.

We need a referral page where users can copy their invite link, and we must track sign-ups from each link.
Users should be able to see how many friends joined. Send a reward email when a friend upgrades.
The API needs a webhook from Stripe so rewards are applied ASAP.

Nice to have:
- leaderboard of top referrers (nice to have)
- share buttons for X and LinkedIn
- Write the launch blog post`;

describe("demo planner", () => {
  const plan = demoPlan(BRIEF, ["Backend", "Design", "Marketing", "Mobile"]);
  const titles = plan.map((p) => p.title);

  it("keeps requirements and skips small talk", () => {
    expect(titles.some((t) => /referral page/i.test(t))).toBe(true);
    expect(titles).toContain("Track sign-ups from each link");
    expect(titles).toContain("Let users see how many friends joined");
    expect(titles).toContain("Send a reward email when a friend upgrades");
    expect(titles.some((t) => /^Hi\b|launching a referral/i.test(t))).toBe(false);
  });

  it("turns noun bullets into tasks and strips hints", () => {
    expect(titles).toContain("Build the leaderboard of top referrers");
    expect(titles).toContain("Write the launch blog post");
    expect(plan.find((p) => p.title.startsWith("Build the leaderboard"))?.priority).toBe("low");
  });

  it("reads priority, size and labels from the wording", () => {
    const webhook = plan.find((p) => /webhook/i.test(p.title))!;
    expect(webhook.priority).toBe("urgent");
    expect(webhook.labels).toContain("Backend");
    expect(plan.find((p) => p.title === "Track sign-ups from each link")?.priority).toBe("high");
    expect(plan.find((p) => /blog post/.test(p.title))?.labels).toContain("Marketing");
    expect(plan.every((p) => [1, 2, 3, 5, 8].includes(p.estimate))).toBe(true);
  });

  it("adds a release step for launches and caps the list", () => {
    expect(titles).toContain("Plan the release and announce it");
    expect(plan.length).toBeLessThanOrEqual(12);
    expect(new Set(titles.map((t) => t.toLowerCase())).size).toBe(titles.length);
  });

  it("falls back to a starter plan for a vague brief", () => {
    const vague = demoPlan("Something about improving retention.");
    expect(vague.length).toBeGreaterThanOrEqual(4);
  });

  it("splits a list of actions in one sentence", () => {
    const t = demoPlan(
      "We need to add dark mode, fix the login crash and update the pricing copy.",
    ).map((p) => p.title);
    expect(t.slice(0, 3)).toEqual([
      "Add dark mode",
      "Fix the login crash",
      "Update the pricing copy",
    ]);
  });
});

describe("demo planner sections", () => {
  it("applies a 'Nice to have:' heading to its list", () => {
    const plan = demoPlan(
      "We need to add search.\n\nNice to have:\n- saved searches\n- search history",
    );
    expect(plan.find((p) => /saved searches/.test(p.title))?.priority).toBe("low");
    expect(plan.find((p) => /Add search/.test(p.title))?.priority).toBe("medium");
  });
});
