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
};

export type ProjectData = {
  project: {
    id: string;
    key: string;
    name: string;
    color: string;
    description: string;
    workspaceId: string;
  };
  statuses: Status[];
  tasks: BoardTask[];
  people: Person[];
  labels: Label[];
  sprints: Sprint[];
  canEdit: boolean;
};

export type TaskDetail = BoardTask & {
  description: string;
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
  }[];
  activity: {
    id: string;
    action: string;
    meta: Record<string, unknown>;
    createdAt: string;
    actor: Person | null;
  }[];
};
