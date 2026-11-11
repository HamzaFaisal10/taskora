import "server-only";
import { richTextToPlain } from "@/lib/rich-text";
import { format, parseISO } from "date-fns";

/**
 * Taskora's AI helpers. With OPENAI_API_KEY set they call OpenAI; without it they run in demo mode and
 * build a sensible answer from the task itself (clearly labelled "Demo AI" in the UI).
 */

export type AiMode = "live" | "demo";
export type SubtaskIdea = { title: string; estimate: number };
export type TaskContext = {
  title: string;
  description: string;
  labels: string[];
  status: string;
  assignee: string | null;
  dueDate: string | null;
  subtasks: { title: string; done: boolean }[];
  blockers: { ref: string; title: string; done: boolean }[];
  comments: { author: string; body: string }[];
};

export const aiMode = (): AiMode => (process.env.OPENAI_API_KEY?.trim() ? "live" : "demo");

/* ------------------------------- Live mode ------------------------------- */

async function openai<T>(system: string, user: string): Promise<T> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY!.replace(/\s+/g, "")}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  return JSON.parse(json.choices[0].message.content) as T;
}

const SYSTEM =
  "You are the assistant inside Taskora, a project management app for product teams. Be concrete, short and practical. Never invent facts that are not in the task. Answer only with JSON.";

const describe = (t: TaskContext) =>
  JSON.stringify({
    title: t.title,
    description: richTextToPlain(t.description),
    labels: t.labels,
    status: t.status,
    assignee: t.assignee,
    due: t.dueDate,
    subtasks: t.subtasks,
    blocked_by: t.blockers,
    comments: t.comments.slice(-15),
  });

/* ------------------------------- Demo mode ------------------------------- */

const PLAYBOOKS: { match: RegExp; steps: [string, number][] }[] = [
  {
    match: /stripe|payment|billing|checkout|subscription|invoice|paywall/i,
    steps: [
      ["Create products and prices in the Stripe dashboard", 1],
      ["Build the checkout session endpoint", 2],
      ["Verify webhook signatures and store events idempotently", 3],
      ["Sync the workspace plan on subscription changes", 2],
      ["Add a billing portal link in Settings", 1],
      ["Test upgrades, downgrades and failed payments in test mode", 2],
    ],
  },
  {
    match: /crash|bug|error|fix|broken|fails?|blank/i,
    steps: [
      ["Reproduce the issue and write down the exact steps", 1],
      ["Collect logs or a crash report from an affected device", 1],
      ["Find the root cause and write a failing test", 2],
      ["Ship the fix behind a quick review", 2],
      ["Confirm with the people who reported it", 1],
    ],
  },
  {
    match: /design|screen|onboarding|ui|layout|mockup|empty state/i,
    steps: [
      ["Collect references and list the states each screen needs", 1],
      ["Sketch the flow in low fidelity", 2],
      ["Design the screens in both light and dark themes", 3],
      ["Review with the team and capture feedback", 1],
      ["Prepare a hand-off with spacing, copy and assets", 1],
    ],
  },
  {
    match: /api|endpoint|backend|database|auth|sync|webhook|rate limit/i,
    steps: [
      ["Write a short spec for inputs, outputs and errors", 1],
      ["Add the database changes with a migration", 2],
      ["Implement the endpoint with validation", 3],
      ["Cover the happy path and edge cases with tests", 2],
      ["Document the endpoint for the client team", 1],
    ],
  },
  {
    match: /email|launch|marketing|campaign|copy|announcement|blog/i,
    steps: [
      ["Agree on the audience and the one message to land", 1],
      ["Draft the copy and subject lines", 2],
      ["Design the template and test it on mobile", 2],
      ["Get sign-off from the product owner", 1],
      ["Schedule the send and track opens and clicks", 1],
    ],
  },
];

const GENERIC: [string, number][] = [
  ["Clarify the goal and what done looks like", 1],
  ["Break the work into a first small version", 1],
  ["Build the first version", 3],
  ["Review it with the team", 1],
  ["Polish and ship", 2],
];

function demoBreakdown(t: TaskContext): SubtaskIdea[] {
  // The title and labels say what the task is; the description is only a tie-breaker.
  const primary = `${t.title} ${t.labels.join(" ")}`;
  const steps =
    PLAYBOOKS.find((p) => p.match.test(primary))?.steps ??
    PLAYBOOKS.find((p) => p.match.test(t.description))?.steps ??
    GENERIC;
  const existing = new Set(t.subtasks.map((s) => s.title.toLowerCase()));
  return steps
    .filter(([title]) => !existing.has(title.toLowerCase()))
    .map(([title, estimate]) => ({ title, estimate }));
}

function demoSummary(t: TaskContext): string[] {
  const done = t.subtasks.filter((s) => s.done).length;
  const openBlockers = t.blockers.filter((b) => !b.done);
  const last = t.comments.at(-1);
  const lines = [
    `${t.status}${t.assignee ? ` with ${t.assignee}` : ", nobody assigned yet"}${t.dueDate ? `, due ${format(parseISO(t.dueDate), "MMM d")}` : ""}.` +
      (t.subtasks.length ? ` ${done} of ${t.subtasks.length} subtasks done.` : ""),
  ];
  if (openBlockers.length)
    lines.push(`Blocked by ${openBlockers.map((b) => `${b.ref} (${b.title})`).join(", ")}.`);
  else if (t.blockers.length) lines.push("All blockers are resolved.");
  if (last)
    lines.push(
      `Latest from ${last.author}: “${last.body.length > 140 ? `${last.body.slice(0, 137)}…` : last.body}”`,
    );
  else if (t.description) lines.push(t.description.split(/(?<=\.)\s/)[0]);
  const next = t.subtasks.find((s) => !s.done);
  if (next && lines.length < 3) lines.push(`Next step: ${next.title}.`);
  return lines.slice(0, 3);
}

function demoDescription(t: TaskContext): string {
  const steps = demoBreakdown({ ...t, subtasks: [] }).slice(0, 4);
  return [
    `Goal: ${t.title.replace(/\.$/, "")}.`,
    "",
    "Acceptance criteria:",
    ...steps.map((s) => `- ${s.title}`),
    "",
    "Out of scope: anything not needed for the first release.",
  ].join("\n");
}

/* --------------------------------- API ----------------------------------- */

export async function breakdownTask(
  t: TaskContext,
): Promise<{ mode: AiMode; subtasks: SubtaskIdea[] }> {
  if (aiMode() === "demo") return { mode: "demo", subtasks: demoBreakdown(t) };
  const out = await openai<{ subtasks: SubtaskIdea[] }>(
    SYSTEM,
    `Break this task into 3-6 subtasks someone can finish in a day or less. Skip any that already exist. Each has "title" (imperative, under 70 characters) and "estimate" (story points: 1, 2, 3 or 5). Return {"subtasks": [...]}.\n\nTask: ${describe(t)}`,
  );
  return {
    mode: "live",
    subtasks: (out.subtasks ?? []).slice(0, 6).map((s) => ({
      title: String(s.title).slice(0, 120),
      estimate: [1, 2, 3, 5].includes(s.estimate) ? s.estimate : 2,
    })),
  };
}

export async function summarizeTask(t: TaskContext): Promise<{ mode: AiMode; lines: string[] }> {
  if (aiMode() === "demo") return { mode: "demo", lines: demoSummary(t) };
  const out = await openai<{ lines: string[] }>(
    SYSTEM,
    `Summarize where this task stands in exactly three short lines for a teammate who missed the discussion: status and owner, what is blocking or decided, and the next step. Return {"lines": ["...", "...", "..."]}.\n\nTask: ${describe(t)}`,
  );
  return { mode: "live", lines: (out.lines ?? []).slice(0, 3).map((l) => String(l).slice(0, 240)) };
}

export async function draftDescription(
  t: TaskContext,
): Promise<{ mode: AiMode; description: string }> {
  if (aiMode() === "demo") return { mode: "demo", description: demoDescription(t) };
  const out = await openai<{ description: string }>(
    SYSTEM,
    `Write a clear task description in plain text: one line with the goal, then "Acceptance criteria:" with 3-5 bullet points starting with "- ", then one line on what is out of scope. Keep it under 120 words. Return {"description": "..."}.\n\nTask: ${describe(t)}`,
  );
  return { mode: "live", description: String(out.description ?? "").slice(0, 4000) };
}
