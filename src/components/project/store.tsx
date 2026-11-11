"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  archiveTask,
  archiveTasks,
  bulkUpdateTasks,
  createTask,
  moveTask,
  setTaskLabels,
  updateTask,
  type TaskPatch,
} from "@/lib/project/actions";
import type { BoardTask, ProjectData, Status } from "@/lib/project/types";
import { useLive } from "@/lib/realtime/use-live";

export type Filters = { q: string; assignees: string[]; priorities: string[]; labels: string[] };
const EMPTY: Filters = { q: "", assignees: [], priorities: [], labels: [] };

type Store = ProjectData & {
  basePath: string;
  allTasks: BoardTask[];
  /** Tasks after filters are applied. */
  tasks: BoardTask[];
  statusById: Map<string, Status>;
  filters: Filters;
  setFilters: (f: Filters) => void;
  activeFilterCount: number;
  openTask: (ref: string | null) => void;
  openRef: string | null;
  update: (taskId: string, patch: TaskPatch) => void;
  move: (taskId: string, statusId: string, beforeId: string | null, afterId: string | null) => void;
  create: (
    title: string,
    opts?: {
      statusId?: string;
      dueDate?: string | null;
      parentId?: string | null;
      estimate?: number | null;
      refresh?: boolean;
    },
  ) => Promise<string | null>;
  /** Re-fetch the project from the server. */
  refresh: () => void;
  setLabels: (taskId: string, labelIds: string[]) => void;
  archive: (taskId: string) => void;
  bulkUpdate: (
    taskIds: string[],
    patch: Pick<TaskPatch, "statusId" | "priority" | "assigneeId" | "sprintId" | "dueDate">,
  ) => void;
  bulkArchive: (taskIds: string[]) => void;
  pending: boolean;
};

const Ctx = createContext<Store | null>(null);

const PATCH_TO_TASK: Partial<Record<keyof TaskPatch, keyof BoardTask>> = {
  title: "title",
  statusId: "statusId",
  priority: "priority",
  assigneeId: "assigneeId",
  sprintId: "sprintId",
  startDate: "startDate",
  dueDate: "dueDate",
  estimate: "estimate",
};

function positionBetween(tasks: BoardTask[], beforeId: string | null, afterId: string | null) {
  const before = tasks.find((t) => t.id === beforeId)?.position;
  const after = tasks.find((t) => t.id === afterId)?.position;
  if (before != null && after != null) return (before + after) / 2;
  if (before != null) return before + 1024;
  if (after != null) return after - 1024;
  return 1024;
}

export function ProjectProvider({
  data,
  basePath,
  children,
}: {
  data: ProjectData;
  basePath: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // Local copy for optimistic updates; replaced whenever the server sends fresh data.
  const [source, setSource] = useState(data);
  const [tasks, setTasks] = useState(data.tasks);
  if (source !== data) {
    setSource(data);
    setTasks(data.tasks);
  }
  const [filters, setFilters] = useState<Filters>(EMPTY);

  const statusById = useMemo(() => new Map(data.statuses.map((s) => [s.id, s])), [data.statuses]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return tasks.filter(
      (t) =>
        (!q || t.title.toLowerCase().includes(q) || t.ref.toLowerCase().includes(q)) &&
        (filters.assignees.length === 0 || filters.assignees.includes(t.assigneeId ?? "none")) &&
        (filters.priorities.length === 0 || filters.priorities.includes(t.priority)) &&
        (filters.labels.length === 0 || t.labelIds.some((l) => filters.labels.includes(l))),
    );
  }, [tasks, filters]);

  const openRef = searchParams.get("task");
  const openTask = useCallback(
    (ref: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (ref) params.set("task", ref);
      else params.delete("task");
      const qs = params.toString();
      // Shallow URL update: Next.js syncs useSearchParams with the History API without a server round trip.
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, searchParams],
  );

  const run = useCallback(
    (
      optimistic: (prev: BoardTask[]) => BoardTask[],
      action: () => Promise<{ ok: boolean; error?: string }>,
      refreshAfter = false,
    ) => {
      const snapshot = tasks;
      setTasks(optimistic);
      startTransition(async () => {
        const res = await action();
        if (!res.ok) {
          setTasks(snapshot);
          toast.error(res.error ?? "Something went wrong.");
        } else if (refreshAfter) router.refresh();
      });
    },
    [tasks, router],
  );

  // Teammates' changes stream in and refresh the project (debounced, so a burst becomes one refresh).
  useLive(
    `project:${data.project.id}`,
    [
      { table: "tasks", filter: `project_id=eq.${data.project.id}` },
      { table: "task_statuses", filter: `project_id=eq.${data.project.id}` },
    ],
    () => router.refresh(),
    600,
  );

  const store: Store = {
    ...data,
    basePath,
    allTasks: tasks,
    tasks: filtered,
    statusById,
    filters,
    setFilters,
    activeFilterCount:
      filters.assignees.length +
      filters.priorities.length +
      filters.labels.length +
      (filters.q ? 1 : 0),
    openTask,
    openRef,
    pending,
    refresh: () => router.refresh(),
    update: (taskId, patch) => {
      run(
        (prev) =>
          prev.map((t) => {
            if (t.id !== taskId) return t;
            const next = { ...t };
            for (const [k, v] of Object.entries(patch)) {
              const field = PATCH_TO_TASK[k as keyof TaskPatch];
              if (field) (next as Record<string, unknown>)[field] = v;
            }
            return next;
          }),
        () => updateTask({ path: basePath, taskId, patch }),
        // Finishing a task can create the next one of a repeating task, so fetch the board again.
        !!patch.statusId && statusById.get(patch.statusId)?.category === "completed",
      );
    },
    move: (taskId, statusId, beforeId, afterId) => {
      run(
        (prev) => {
          const column = prev.filter((t) => t.statusId === statusId && t.id !== taskId);
          const position = positionBetween(column, beforeId, afterId);
          return prev.map((t) => (t.id === taskId ? { ...t, statusId, position } : t));
        },
        () => moveTask({ path: basePath, taskId, statusId, beforeId, afterId }),
        statusById.get(statusId)?.category === "completed",
      );
    },
    setLabels: (taskId, labelIds) => {
      run(
        (prev) => prev.map((t) => (t.id === taskId ? { ...t, labelIds } : t)),
        () => setTaskLabels({ path: basePath, taskId, labelIds }),
      );
    },
    bulkUpdate: (taskIds, patch) => {
      const ids = new Set(taskIds);
      run(
        (prev) =>
          prev.map((t) => {
            if (!ids.has(t.id)) return t;
            const next = { ...t };
            for (const [k, v] of Object.entries(patch)) {
              const field = PATCH_TO_TASK[k as keyof TaskPatch];
              if (field) (next as Record<string, unknown>)[field] = v;
            }
            return next;
          }),
        () => bulkUpdateTasks({ path: basePath, taskIds, patch }),
        !!patch.statusId && statusById.get(patch.statusId)?.category === "completed",
      );
    },
    bulkArchive: (taskIds) => {
      const ids = new Set(taskIds);
      run(
        (prev) => prev.filter((t) => !ids.has(t.id)),
        () => archiveTasks({ path: basePath, taskIds }),
      );
    },
    archive: (taskId) => {
      run(
        (prev) => prev.filter((t) => t.id !== taskId),
        () => archiveTask({ path: basePath, taskId }),
      );
    },
    create: async (title, opts) => {
      const { refresh: shouldRefresh = true, ...fields } = opts ?? {};
      const res = await createTask({
        path: basePath,
        projectId: data.project.id,
        title,
        ...fields,
      });
      if (!res.ok) {
        toast.error(res.error);
        return null;
      }
      if (shouldRefresh) router.refresh();
      return `${data.project.key}-${res.data.number}`;
    },
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useProject() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProject must be used inside ProjectProvider");
  return v;
}

export const isDoneCategory = (c: string) => c === "completed" || c === "canceled";
