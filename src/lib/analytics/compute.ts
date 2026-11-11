import {
  addDays,
  addWeeks,
  differenceInCalendarDays,
  differenceInHours,
  format,
  parseISO,
  startOfWeek,
} from "date-fns";

export type AnalyticsTask = {
  id: string;
  projectId: string;
  assigneeId: string | null;
  createdAt: string;
  completedAt: string | null;
  dueDate: string | null;
  estimate: number | null;
  category: string;
  /** Extra fields used by the CSV export. */
  ref?: string;
  title?: string;
  status?: string;
  priority?: string;
};

export type WeekPoint = { start: string; label: string; completed: number; created: number };

const isOpen = (t: AnalyticsTask) => t.category !== "completed" && t.category !== "canceled";

export function median(values: number[]) {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Created and completed tasks per week (weeks start on Monday), oldest first. */
export function weekly(tasks: AnalyticsTask[], weeks: number, now = new Date()): WeekPoint[] {
  const first = startOfWeek(addWeeks(now, -(weeks - 1)), { weekStartsOn: 1 });
  const points: WeekPoint[] = Array.from({ length: weeks }, (_, i) => {
    const start = addWeeks(first, i);
    return {
      start: format(start, "yyyy-MM-dd"),
      label: format(start, "MMM d"),
      completed: 0,
      created: 0,
    };
  });
  const index = (iso: string) => Math.floor(differenceInCalendarDays(parseISO(iso), first) / 7);
  for (const t of tasks) {
    const c = index(t.createdAt);
    if (c >= 0 && c < weeks) points[c].created += 1;
    if (t.completedAt && t.category === "completed") {
      const d = index(t.completedAt);
      if (d >= 0 && d < weeks) points[d].completed += 1;
    }
  }
  return points;
}

export type Kpis = {
  completed: number;
  completedBefore: number;
  cycleDays: number | null;
  cycleDaysBefore: number | null;
  open: number;
  overdue: number;
};

/** Headline numbers for the last `days` days compared with the period before. */
export function kpis(tasks: AnalyticsTask[], days = 30, now = new Date()): Kpis {
  const from = addDays(now, -days);
  const before = addDays(now, -2 * days);
  const inRange = (iso: string, a: Date, b: Date) => {
    const d = parseISO(iso);
    return d >= a && d < b;
  };
  const done = tasks.filter((t) => t.category === "completed" && t.completedAt);
  const recent = done.filter((t) => inRange(t.completedAt!, from, now));
  const prior = done.filter((t) => inRange(t.completedAt!, before, from));
  const cycle = (list: AnalyticsTask[]) =>
    median(
      list.map((t) =>
        Math.max(0, differenceInHours(parseISO(t.completedAt!), parseISO(t.createdAt)) / 24),
      ),
    );
  const today = format(now, "yyyy-MM-dd");
  const open = tasks.filter(isOpen);
  return {
    completed: recent.length,
    completedBefore: prior.length,
    cycleDays: cycle(recent),
    cycleDaysBefore: cycle(prior),
    open: open.length,
    overdue: open.filter((t) => t.dueDate && t.dueDate < today).length,
  };
}

export type Workload = { personId: string | null; open: number; overdue: number; points: number };

/** Open work per assignee, busiest first. */
export function workload(tasks: AnalyticsTask[], now = new Date()): Workload[] {
  const today = format(now, "yyyy-MM-dd");
  const map = new Map<string | null, Workload>();
  for (const t of tasks.filter(isOpen)) {
    const w = map.get(t.assigneeId) ?? { personId: t.assigneeId, open: 0, overdue: 0, points: 0 };
    w.open += 1;
    w.points += t.estimate ?? 1;
    if (t.dueDate && t.dueDate < today) w.overdue += 1;
    map.set(t.assigneeId, w);
  }
  // Busiest people first; unassigned work is listed last so it reads as a separate bucket.
  return [...map.values()].sort(
    (a, b) => Number(a.personId === null) - Number(b.personId === null) || b.open - a.open,
  );
}

export type ProjectStats = {
  projectId: string;
  total: number;
  open: number;
  done: number;
  completedRecent: number;
  overdue: number;
};

export function byProject(tasks: AnalyticsTask[], days = 30, now = new Date()): ProjectStats[] {
  const from = addDays(now, -days);
  const today = format(now, "yyyy-MM-dd");
  const map = new Map<string, ProjectStats>();
  for (const t of tasks) {
    const p = map.get(t.projectId) ?? {
      projectId: t.projectId,
      total: 0,
      open: 0,
      done: 0,
      completedRecent: 0,
      overdue: 0,
    };
    if (t.category === "canceled") {
      map.set(t.projectId, p);
      continue;
    }
    p.total += 1;
    if (isOpen(t)) {
      p.open += 1;
      if (t.dueDate && t.dueDate < today) p.overdue += 1;
    } else {
      p.done += 1;
      if (t.completedAt && parseISO(t.completedAt) >= from) p.completedRecent += 1;
    }
    map.set(t.projectId, p);
  }
  return [...map.values()];
}

export const CATEGORY_ORDER = [
  "triage",
  "backlog",
  "unstarted",
  "started",
  "review",
  "completed",
  "canceled",
] as const;
export const CATEGORY_LABEL: Record<(typeof CATEGORY_ORDER)[number], string> = {
  triage: "Triage",
  backlog: "Backlog",
  unstarted: "To do",
  started: "In progress",
  review: "In review",
  completed: "Done",
  canceled: "Canceled",
};

/** Task counts per workflow stage, in workflow order. Stages with no tasks are left out. */
export function byStatus(tasks: AnalyticsTask[]) {
  const total = tasks.length;
  return CATEGORY_ORDER.map((category) => {
    const count = tasks.filter((t) => t.category === category).length;
    return { category, label: CATEGORY_LABEL[category], count, share: total ? count / total : 0 };
  }).filter((r) => r.count > 0);
}
