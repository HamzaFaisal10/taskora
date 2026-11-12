import type { Priority } from "@/components/tasks/task-meta";

export type StatusCategory =
  "triage" | "backlog" | "unstarted" | "started" | "review" | "completed" | "canceled";

export type Status = {
  id: string;
  name: string;
  color: string;
  category: StatusCategory;
  position: number;
};
export type Person = { id: string; name: string; avatarUrl: string | null; role?: string };
export type Label = { id: string; name: string; tone: string };
export type Sprint = {
  id: string;
  name: string;
  goal: string;
  state: "planned" | "active" | "completed";
  startDate: string;
  endDate: string;
};

export type BoardTask = {
  id: string;
  number: number;
  ref: string;
  title: string;
  statusId: string;
  priority: Priority;
  assigneeId: string | null;
  sprintId: string | null;
  startDate: string | null;
  dueDate: string | null;
  estimate: number | null;
  position: number;
  labelIds: string[];
  subtasks: { total: number; done: number };
  comments: number;
  completedAt: string | null;
  createdAt: string;
  recurring: boolean;
};

export type FieldKind = "text" | "number" | "date" | "select" | "checkbox" | "person";
export type CustomField = {
  id: string;
  name: string;
  kind: FieldKind;
  options: string[];
  position: number;
};
export type FieldValue = string | number | boolean;
export type Recurrence = { freq: "daily" | "weekdays" | "weekly" | "monthly"; interval: number };

export type ProjectData = {
  project: {
    id: string;
    key: string;
    name: string;
    color: string;
    description: string;
    workspaceId: string;
    createdBy: string | null;
  };
  statuses: Status[];
  tasks: BoardTask[];
  people: Person[];
  labels: Label[];
  sprints: Sprint[];
  fields: CustomField[];
  canEdit: boolean;
};

export type TaskDetail = BoardTask & {
  description: string;
  /** Set when the task is archived: it opens from links but is hidden from boards and lists. */
  archivedAt: string | null;
  recurrence: Recurrence | null;
  fieldValues: Record<string, FieldValue>;
  creator: Person | null;
  parent: { id: string; ref: string; title: string } | null;
  children: {
    id: string;
    ref: string;
    title: string;
    statusId: string;
    assigneeId: string | null;
  }[];
  blockedBy: { id: string; ref: string; title: string; done: boolean }[];
  commentList: {
    id: string;
    body: string;
    createdAt: string;
    editedAt: string | null;
    author: Person | null;
    reactions: { emoji: string; userIds: string[] }[];
  }[];
  attachments: {
    id: string;
    fileName: string;
    path: string;
    sizeBytes: number;
    mimeType: string;
    createdAt: string;
    uploader: Person | null;
  }[];
  time: {
    id: string;
    user: Person | null;
    startedAt: string;
    endedAt: string | null;
    durationSeconds: number | null;
    note: string;
  }[];
  activity: {
    id: string;
    action: string;
    meta: Record<string, unknown>;
    createdAt: string;
    actor: Person | null;
  }[];
};
