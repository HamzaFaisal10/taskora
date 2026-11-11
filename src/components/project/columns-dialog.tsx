"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { StatusDot } from "@/components/tasks/task-meta";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { deleteStatus, reorderStatuses, saveStatus } from "@/lib/project/status-actions";
import type { Status } from "@/lib/project/types";
import { statusGroup } from "./pickers";
import { useProject } from "./store";

const COLORS = [
  "#E58BD8",
  "#8A919B",
  "#A9B1BC",
  "#F5B841",
  "#6CA8FF",
  "#4FD18B",
  "#5C636D",
  "#FF7A66",
  "#A48BFA",
  "#5EE0D8",
];
const CATEGORIES: { value: Status["category"]; label: string }[] = [
  { value: "triage", label: "Triage" },
  { value: "backlog", label: "Backlog" },
  { value: "unstarted", label: "Not started" },
  { value: "started", label: "In progress" },
  { value: "review", label: "In review" },
  { value: "completed", label: "Done" },
  { value: "canceled", label: "Canceled" },
];

function Row({ status, count, others }: { status: Status; count: number; others: Status[] }) {
  const { basePath, project } = useProject();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: status.id,
  });
  const [name, setName] = useState(status.name);
  const [deleting, setDeleting] = useState(false);
  const [moveTo, setMoveTo] = useState(others[0]?.id ?? "");
  const [pending, start] = useTransition();

  const save = (patch: Partial<Pick<Status, "name" | "color" | "category">>) =>
    start(async () => {
      const res = await saveStatus({
        path: basePath,
        projectId: project.id,
        id: status.id,
        name: patch.name ?? status.name,
        color: patch.color ?? status.color,
        category: patch.category ?? status.category,
      });
      if (!res.ok) toast.error(res.error);
    });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? "relative z-10 opacity-80" : undefined}
    >
      <div
        className="border-border bg-card rounded-control flex flex-wrap items-center gap-2 border p-2"
        aria-busy={pending}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="text-subtle hover:text-fg cursor-grab touch-none rounded p-1"
          aria-label={`Reorder ${status.name}`}
        >
          <GripVertical className="size-4" />
        </button>
        <StatusDot color={status.color} group={statusGroup(status.category)} />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== status.name && save({ name: name.trim() })}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          aria-label="Column name"
          className="h-8 min-w-0 flex-1"
        />
        <select
          aria-label="Color"
          value={status.color}
          onChange={(e) => save({ color: e.target.value })}
          className="border-border bg-card rounded-control h-8 w-10 border text-xs"
          style={{ color: status.color }}
        >
          {[...new Set([status.color, ...COLORS])].map((c) => (
            <option key={c} value={c} style={{ color: c }}>
              ●
            </option>
          ))}
        </select>
        <select
          aria-label="Counts as"
          value={status.category}
          onChange={(e) => save({ category: e.target.value as Status["category"] })}
          className="border-border bg-card rounded-control h-8 border px-1.5 text-xs"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <span className="text-subtle w-14 text-right text-xs tabular-nums">{count} tasks</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${status.name}`}
          disabled={others.length === 0}
          onClick={() => setDeleting((d) => !d)}
        >
          <Trash2 />
        </Button>
      </div>
      {deleting && (
        <div className="bg-danger-soft text-danger-text rounded-control mt-1 flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
          <span>{count ? `Move its ${count} tasks to` : "Delete this column?"}</span>
          {count > 0 && (
            <select
              aria-label="Move tasks to"
              value={moveTo}
              onChange={(e) => setMoveTo(e.target.value)}
              className="border-border bg-card text-fg rounded-control h-7 border px-1.5"
            >
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
          <Button
            type="button"
            size="sm"
            variant="danger"
            className="ml-auto"
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await deleteStatus({ path: basePath, id: status.id, moveTo });
                if (!res.ok) toast.error(res.error);
                else toast.success(`Deleted ${status.name}`);
              })
            }
          >
            Delete column
          </Button>
        </div>
      )}
    </li>
  );
}

export function ColumnsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { statuses, allTasks, basePath, project } = useProject();
  const [order, setOrder] = useState(statuses.map((s) => s.id));
  const [prev, setPrev] = useState(statuses);
  if (prev !== statuses) {
    setPrev(statuses);
    setOrder(statuses.map((s) => s.id));
  }
  const [newName, setNewName] = useState("");
  const [pending, start] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const byId = new Map(statuses.map((s) => [s.id, s]));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    setOrder(next);
    start(async () => {
      const res = await reorderStatuses({ path: basePath, ids: next });
      if (!res.ok) toast.error(res.error);
    });
  };

  const add = () =>
    start(async () => {
      if (!newName.trim()) return;
      // New columns go just before the first finished column (Done), not after Canceled.
      const id = crypto.randomUUID();
      const finished = order.findIndex((o) =>
        ["completed", "canceled"].includes(byId.get(o)?.category ?? ""),
      );
      const next = [...order];
      next.splice(finished >= 0 ? finished : next.length, 0, id);
      const res = await saveStatus({
        path: basePath,
        projectId: project.id,
        newId: id,
        name: newName.trim(),
        color: "#A48BFA",
        category: "started",
        position: next.indexOf(id),
      });
      if (!res.ok) return void toast.error(res.error);
      const reordered = await reorderStatuses({ path: basePath, ids: next });
      if (!reordered.ok) toast.error(reordered.error);
      setNewName("");
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Board columns</DialogTitle>
          <DialogDescription>
            Rename, recolor and drag to reorder. &ldquo;Counts as&rdquo; tells sprints, analytics
            and automations what each column means.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1.5">
                {order.map((id) => {
                  const s = byId.get(id);
                  if (!s) return null;
                  return (
                    <Row
                      key={id}
                      status={s}
                      count={allTasks.filter((t) => t.statusId === id).length}
                      others={statuses.filter((o) => o.id !== id)}
                    />
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New column, e.g. Blocked"
              aria-label="New column name"
              className="h-9"
            />
            <Button
              type="submit"
              size="sm"
              className="h-9"
              loading={pending}
              disabled={!newName.trim()}
            >
              <Plus /> Add column
            </Button>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
