/** Starter content for new projects. Due dates are days from today. */
export type TemplateId = "blank" | "software" | "marketing" | "client";

export const TEMPLATES: Record<
  TemplateId,
  {
    name: string;
    description: string;
    tasks: { title: string; due: number | null; priority: "low" | "medium" | "high" }[];
  }
> = {
  blank: { name: "Blank", description: "An empty board with the standard columns.", tasks: [] },
  software: {
    name: "Product build",
    description: "Spec, design, build, test and ship a feature.",
    tasks: [
      { title: "Write the spec and acceptance criteria", due: 2, priority: "high" },
      { title: "Design the key screens", due: 5, priority: "high" },
      { title: "Build the first version", due: 10, priority: "medium" },
      { title: "Test on real devices", due: 12, priority: "medium" },
      { title: "Ship to beta testers", due: 14, priority: "high" },
    ],
  },
  marketing: {
    name: "Marketing campaign",
    description: "Plan, create and launch a campaign, then review it.",
    tasks: [
      { title: "Agree on the audience and the main message", due: 2, priority: "high" },
      { title: "Draft the landing page copy", due: 5, priority: "medium" },
      { title: "Design ads and social posts", due: 7, priority: "medium" },
      { title: "Schedule the launch emails", due: 9, priority: "medium" },
      { title: "Review results one week after launch", due: 17, priority: "low" },
    ],
  },
  client: {
    name: "Client project",
    description: "From kick-off to final delivery, with review rounds.",
    tasks: [
      { title: "Kick-off call with the client", due: 1, priority: "high" },
      { title: "Collect requirements and assets", due: 4, priority: "high" },
      { title: "Share the first draft", due: 10, priority: "medium" },
      { title: "Client review and feedback round", due: 13, priority: "medium" },
      { title: "Final delivery and handover", due: 20, priority: "high" },
    ],
  },
};

/** "Mobile App v2" → "MOB", "Q4 launch" → "QLA" */
export function suggestKey(name: string) {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const letters =
    words.length >= 3 ? words.map((w) => w[0]).join("") : (words[0] ?? "").slice(0, 3);
  const key = letters.replace(/^[0-9]+/, "").slice(0, 4);
  return key.length >= 2 ? key : "PRJ";
}

export const PROJECT_COLORS = [
  "#CDF461",
  "#6CA8FF",
  "#F5B841",
  "#E58BD8",
  "#4FD18B",
  "#FF7A66",
  "#A48BFA",
  "#5EE0D8",
];
