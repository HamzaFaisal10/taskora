/**
 * Maps rows from a CSV file onto new tasks for a project. Headers are matched loosely ("Task name",
 * "Summary" and "Title" all work), and statuses, people and labels are matched by name. Anything that
 * can't be matched is reported instead of guessed.
 */

export type ImportContext = {
  statuses: { id: string; name: string; category: string }[];
  people: { id: string; name: string; email?: string }[];
  labels: { id: string; name: string }[];
};

export type ImportedTask = {
  title: string;
  description: string;
  statusId: string | null;
  priority: "none" | "low" | "medium" | "high" | "urgent";
  assigneeId: string | null;
  dueDate: string | null;
  estimate: number | null;
  labelIds: string[];
};

export type ImportResult = {
  tasks: ImportedTask[];
  /** Which spreadsheet column fills each field, for the preview. */
  columns: Partial<Record<Field, string>>;
  warnings: string[];
  skipped: number;
};

type Field =
  "title" | "description" | "status" | "priority" | "assignee" | "due" | "estimate" | "labels";

const HEADERS: Record<Field, RegExp> = {
  title: /^(title|name|task|task name|summary|subject|issue)$/,
  description: /^(description|details|notes|body|content)$/,
  status: /^(status|state|column|stage|list|section)$/,
  priority: /^(priority|importance|severity)$/,
  assignee: /^(assignee|assigned to|owner|assignee email|responsible)$/,
  due: /^(due|due date|deadline|due on|end date)$/,
  estimate: /^(estimate|points|story points|size|effort)$/,
  labels: /^(labels?|tags?)$/,
};

const PRIORITY: Record<string, ImportedTask["priority"]> = {
  urgent: "urgent",
  critical: "urgent",
  highest: "urgent",
  blocker: "urgent",
  p0: "urgent",
  high: "high",
  p1: "high",
  medium: "medium",
  normal: "medium",
  p2: "medium",
  low: "low",
  lowest: "low",
  p3: "low",
  none: "none",
  "": "none",
};

const MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
const pad = (n: number) => String(n).padStart(2, "0");
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Accepts 2026-11-20, 2026/11/20, 20/11/2026, 11/20/2026 (when unambiguous), "Nov 20, 2026", "20 Nov 2026". */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let r: RegExpMatchArray | null;
  if ((r = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) [y, m, d] = [+r[1], +r[2], +r[3]];
  else if ((r = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) {
    const a = +r[1];
    const b = +r[2];
    y = +r[3];
    // Day first unless that's impossible (13/…) — then month first.
    if (a > 12) [d, m] = [a, b];
    else if (b > 12) [m, d] = [a, b];
    else [d, m] = [a, b];
  } else if ((r = s.match(/^([a-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4})$/i)))
    [m, d, y] = [MONTHS.indexOf(r[1].toLowerCase()) + 1, +r[2], +r[3]];
  else if ((r = s.match(/^(\d{1,2}) ([a-z]{3})[a-z]*\.?,? (\d{4})$/i)))
    [d, m, y] = [+r[1], MONTHS.indexOf(r[2].toLowerCase()) + 1, +r[3]];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (!m || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function mapImport(rows: string[][], ctx: ImportContext, limit = 500): ImportResult {
  const warnings: string[] = [];
  if (rows.length < 2)
    return {
      tasks: [],
      columns: {},
      warnings: ["The file needs a header row and at least one task."],
      skipped: 0,
    };
  const header = rows[0].map(norm);
  const index: Partial<Record<Field, number>> = {};
  const columns: ImportResult["columns"] = {};
  (Object.keys(HEADERS) as Field[]).forEach((f) => {
    const i = header.findIndex((h, j) => HEADERS[f].test(h) && !Object.values(index).includes(j));
    if (i >= 0) {
      index[f] = i;
      columns[f] = rows[0][i].trim();
    }
  });
  if (index.title === undefined)
    return {
      tasks: [],
      columns,
      warnings: [
        'No title column found. Name one of the columns "Title" (or "Name", "Task", "Summary").',
      ],
      skipped: rows.length - 1,
    };

  const statusByName = new Map(ctx.statuses.map((s) => [norm(s.name), s.id]));
  // Taskora's own export has a "Stage" column with the workflow stage; match that too.
  const STAGE: Record<string, string> = {
    "to do": "unstarted",
    "in progress": "started",
    "in review": "review",
    done: "completed",
  };
  // Full names and emails always match; a first name matches only when one member has it.
  const personBy = new Map<string, string>();
  const firstCount = new Map<string, number>();
  for (const p of ctx.people) {
    const first = norm(p.name.split(" ")[0]);
    firstCount.set(first, (firstCount.get(first) ?? 0) + 1);
  }
  for (const p of ctx.people) {
    const first = norm(p.name.split(" ")[0]);
    if (firstCount.get(first) === 1) personBy.set(first, p.id);
  }
  for (const p of ctx.people) {
    personBy.set(norm(p.name), p.id);
    if (p.email) personBy.set(norm(p.email), p.id);
  }
  const labelBy = new Map(ctx.labels.map((l) => [norm(l.name), l.id]));

  const unknown = {
    status: new Set<string>(),
    person: new Set<string>(),
    label: new Set<string>(),
    date: 0,
    priority: new Set<string>(),
  };
  const tasks: ImportedTask[] = [];
  let skipped = 0;
  const get = (row: string[], f: Field) =>
    index[f] === undefined ? "" : (row[index[f]!] ?? "").trim();

  for (const row of rows.slice(1)) {
    const title = get(row, "title").replace(/\s+/g, " ").slice(0, 300);
    if (!title) {
      skipped++;
      continue;
    }
    if (tasks.length >= limit) {
      skipped++;
      continue;
    }
    const statusRaw = get(row, "status");
    let statusId: string | null = null;
    if (statusRaw) {
      statusId = statusByName.get(norm(statusRaw)) ?? null;
      if (!statusId) {
        const cat = STAGE[norm(statusRaw)];
        statusId = (cat && ctx.statuses.find((s) => s.category === cat)?.id) || null;
      }
      if (!statusId) unknown.status.add(statusRaw);
    }
    const priorityRaw = norm(get(row, "priority"));
    const priority = PRIORITY[priorityRaw] ?? "none";
    if (!(priorityRaw in PRIORITY)) unknown.priority.add(get(row, "priority"));
    const who = get(row, "assignee");
    const assigneeId = who ? personBy.get(norm(who)) || null : null;
    if (who && !assigneeId) unknown.person.add(who);
    const dueRaw = get(row, "due");
    const dueDate = dueRaw ? parseDate(dueRaw) : null;
    if (dueRaw && !dueDate) unknown.date++;
    const est = Number.parseFloat(get(row, "estimate"));
    const labelIds: string[] = [];
    for (const name of get(row, "labels")
      .split(/[;,|]/)
      .map((s) => s.trim())
      .filter(Boolean)) {
      const id = labelBy.get(norm(name));
      if (id) {
        if (!labelIds.includes(id)) labelIds.push(id);
      } else unknown.label.add(name);
    }
    tasks.push({
      title,
      description: get(row, "description").slice(0, 50000),
      statusId,
      priority,
      assigneeId,
      dueDate,
      estimate: Number.isFinite(est) ? Math.min(100, Math.max(0, Math.round(est))) : null,
      labelIds: labelIds.slice(0, 10),
    });
  }

  const few = (s: Set<string>) =>
    [...s]
      .slice(0, 3)
      .map((x) => `“${x}”`)
      .join(", ") + (s.size > 3 ? ` and ${s.size - 3} more` : "");
  if (unknown.status.size)
    warnings.push(`Unknown status ${few(unknown.status)}: those tasks go to the first column.`);
  if (unknown.person.size)
    warnings.push(`No member named ${few(unknown.person)}: those tasks stay unassigned.`);
  if (unknown.label.size)
    warnings.push(
      `No label ${few(unknown.label)}: create it in Settings → Labels first to keep it.`,
    );
  if (unknown.priority.size)
    warnings.push(`Unknown priority ${few(unknown.priority)}: set to no priority.`);
  if (unknown.date)
    warnings.push(
      `${unknown.date} due ${unknown.date === 1 ? "date" : "dates"} couldn't be read and were left empty.`,
    );
  if (rows.length - 1 > limit)
    warnings.push(`Only the first ${limit} tasks are imported at a time.`);
  return { tasks, columns, warnings, skipped };
}
