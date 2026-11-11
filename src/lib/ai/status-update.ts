import { differenceInCalendarDays, format, parseISO } from "date-fns";

/**
 * Drafts a project status update from the project's own numbers: what finished this week, how the active
 * sprint is tracking, what is overdue or blocked, and what is due next. Used by demo mode, and as the facts
 * handed to the model in live mode.
 */

export type Health = "on_track" | "at_risk" | "off_track";
export const HEALTH_LABEL: Record<Health, string> = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
};

export type SnapshotTask = {
  ref: string;
  title: string;
  open: boolean;
  priority: "none" | "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  completedAt: string | null;
  estimate: number | null;
  inSprint: boolean;
  openBlockers: string[];
};
export type Snapshot = {
  today: string;
  tasks: SnapshotTask[];
  sprint: { name: string; startDate: string; endDate: string } | null;
};

export type UpdateFacts = {
  finished: SnapshotTask[];
  overdue: SnapshotTask[];
  blocked: SnapshotTask[];
  next: SnapshotTask[];
  sprint: {
    name: string;
    pointsDone: number;
    pointsTotal: number;
    daysLeft: number;
    workShare: number;
    timeShare: number;
  } | null;
  health: Health;
};

const day = (iso: string) => format(parseISO(iso), "MMM d");
const name = (t: SnapshotTask) => `${t.ref} ${t.title}`;
const RANK = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 } as const;

function list(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

export function projectFacts(s: Snapshot): UpdateFacts {
  const today = parseISO(s.today);
  const open = s.tasks.filter((t) => t.open);
  const finished = s.tasks
    .filter(
      (t) =>
        !t.open && t.completedAt && differenceInCalendarDays(today, parseISO(t.completedAt)) <= 7,
    )
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const overdue = open
    .filter((t) => t.dueDate && t.dueDate < s.today)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const blocked = open
    .filter((t) => t.openBlockers.length > 0)
    .sort((a, b) => RANK[a.priority] - RANK[b.priority]);
  const next = open
    .filter(
      (t) =>
        t.dueDate &&
        t.dueDate >= s.today &&
        differenceInCalendarDays(parseISO(t.dueDate), today) <= 10,
    )
    .sort(
      (a, b) =>
        (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || RANK[a.priority] - RANK[b.priority],
    );

  let sprint: UpdateFacts["sprint"] = null;
  if (s.sprint) {
    const inSprint = s.tasks.filter((t) => t.inSprint);
    const pts = (t: SnapshotTask) => t.estimate ?? 1;
    const pointsTotal = inSprint.reduce((n, t) => n + pts(t), 0);
    const pointsDone = inSprint.filter((t) => !t.open).reduce((n, t) => n + pts(t), 0);
    const start = parseISO(s.sprint.startDate);
    const end = parseISO(s.sprint.endDate);
    const length = Math.max(1, differenceInCalendarDays(end, start));
    const elapsed = Math.min(length, Math.max(0, differenceInCalendarDays(today, start)));
    sprint = {
      name: s.sprint.name,
      pointsDone,
      pointsTotal,
      daysLeft: Math.max(0, differenceInCalendarDays(end, today)),
      workShare: pointsTotal ? pointsDone / pointsTotal : 1,
      timeShare: elapsed / length,
    };
  }

  const behind = sprint ? sprint.timeShare - sprint.workShare : 0;
  const seriousBlock = blocked.some((t) => t.priority === "urgent" || t.priority === "high");
  const health: Health =
    overdue.length >= 3 || behind > 0.35
      ? "off_track"
      : overdue.length >= 1 || seriousBlock || behind > 0.15
        ? "at_risk"
        : "on_track";

  return { finished, overdue, blocked, next, sprint, health };
}

/** The update as Markdown (rendered with the same safe rich text as task descriptions). */
export function draftUpdate(s: Snapshot): { health: Health; body: string } {
  const f = projectFacts(s);
  const lines: string[] = [];

  const done =
    f.finished.length === 0
      ? "Nothing was finished in the last 7 days."
      : `Finished ${f.finished.length} ${f.finished.length === 1 ? "task" : "tasks"} this week${
          f.finished.length === 1
            ? `: ${name(f.finished[0])}.`
            : `, including ${list(f.finished.slice(0, 2).map(name))}.`
        }`;
  lines.push(`**${HEALTH_LABEL[f.health]}.** ${done}`);

  if (f.sprint && f.sprint.pointsTotal) {
    const pace =
      f.sprint.timeShare - f.sprint.workShare > 0.15
        ? " That's behind pace."
        : f.sprint.workShare - f.sprint.timeShare > 0.1
          ? " That's ahead of pace."
          : "";
    lines.push(
      `**${f.sprint.name}:** ${f.sprint.pointsDone} of ${f.sprint.pointsTotal} points done with ${f.sprint.daysLeft} ${
        f.sprint.daysLeft === 1 ? "day" : "days"
      } left.${pace}`,
    );
  }

  const risks = [
    ...f.overdue.slice(0, 3).map((t) => `${name(t)} is overdue (due ${day(t.dueDate!)})`),
    ...f.blocked
      .filter((t) => !f.overdue.slice(0, 3).includes(t))
      .slice(0, 2)
      .map((t) => `${name(t)} is waiting on ${list(t.openBlockers)}`),
  ];
  const more = f.overdue.length > 3 ? ` Plus ${f.overdue.length - 3} more overdue.` : "";
  lines.push(
    risks.length
      ? `**Risks:** ${risks.join(". ")}.${more}`
      : "**Risks:** nothing overdue or blocked.",
  );

  if (f.next.length)
    lines.push(
      `**Next up:** ${f.next
        .slice(0, 3)
        .map((t) => `${name(t)} (${day(t.dueDate!)})`)
        .join(", ")}.`,
    );

  return { health: f.health, body: lines.join("\n\n") };
}
