"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Zap } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import {
  PriorityIcon,
  StatusDot,
  type Priority,
  type StatusGroup,
} from "@/components/tasks/task-meta";
import { cn } from "@/lib/utils";

type Card = {
  id: string;
  ref: string;
  title: string;
  who: string;
  priority: Priority;
  tag: string;
};
type Col = {
  id: "unstarted" | "started" | "review";
  name: string;
  color: string;
  group: StatusGroup;
};

const COLS: Col[] = [
  { id: "unstarted", name: "To do", color: "#8A919B", group: "unstarted" },
  { id: "started", name: "In progress", color: "#F2B84B", group: "started" },
  { id: "review", name: "In review", color: "#6CA8FF", group: "review" },
];

const START: Record<Col["id"], Card[]> = {
  unstarted: [
    {
      id: "c1",
      ref: "MOB-126",
      title: "Design onboarding screens",
      who: "Sara Rehman",
      priority: "high",
      tag: "Design",
    },
    {
      id: "c2",
      ref: "MOB-128",
      title: "App Store screenshots",
      who: "Mei Tanaka",
      priority: "low",
      tag: "Design",
    },
  ],
  started: [
    {
      id: "c3",
      ref: "MOB-123",
      title: "Stripe subscriptions & webhooks",
      who: "Alex Morgan",
      priority: "urgent",
      tag: "Payments",
    },
    {
      id: "c4",
      ref: "MOB-124",
      title: "AI task summary endpoint",
      who: "Zain Malik",
      priority: "high",
      tag: "AI",
    },
  ],
  review: [
    {
      id: "c5",
      ref: "MOB-122",
      title: "Kanban drag & drop reorder",
      who: "Sara Rehman",
      priority: "medium",
      tag: "Mobile",
    },
  ],
};

const REVIEWER = "Sara Rehman";

function CardView({
  card,
  overlay,
  dragging,
}: {
  card: Card;
  overlay?: boolean;
  dragging?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-card border-border rounded-[10px] border p-2.5 text-left select-none sm:p-3",
        dragging && "opacity-40",
        overlay && "shadow-pop rotate-[1.5deg] cursor-grabbing",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-subtle font-mono text-[10.5px] sm:text-[11px]">{card.ref}</span>
        <PriorityIcon priority={card.priority} />
      </div>
      <p className="mt-1 text-[12.5px] leading-snug font-medium sm:text-[13px]">{card.title}</p>
      <div className="mt-2.5 flex items-center justify-end sm:justify-between">
        <span className="bg-elevated text-muted hidden rounded-full px-2 py-0.5 text-[11px] sm:inline">
          {card.tag}
        </span>
        <Avatar name={card.who} size={20} />
      </div>
    </div>
  );
}

function Sortable({ card }: { card: Card }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-roledescription="Draggable task"
      aria-label={`${card.ref} ${card.title}`}
      className="cursor-grab touch-manipulation rounded-[10px] outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
    >
      <CardView card={card} dragging={isDragging} />
    </div>
  );
}

function Column({ col, cards }: { col: Col; cards: Card[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex items-center gap-1.5 px-1 pb-2.5 whitespace-nowrap sm:gap-2">
        <StatusDot color={col.color} group={col.group} />
        <span className="truncate text-[11.5px] font-semibold sm:text-[12.5px]">{col.name}</span>
        <span className="text-subtle text-xs tabular-nums">{cards.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "bg-surface/70 flex min-h-48 flex-1 flex-col gap-1.5 rounded-[12px] p-1.5 transition-colors sm:gap-2 sm:p-2",
          isOver && "bg-accent-soft/60",
        )}
      >
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((c) => (
            <Sortable key={c.id} card={c} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

/** A small, working board: drag a card to "In review" and the automation reassigns it. */
export function HeroBoard() {
  const [cols, setCols] = useState(START);
  const [active, setActive] = useState<Card | null>(null);
  const [log, setLog] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columnOf = (id: string) =>
    (Object.keys(cols) as Col["id"][]).find((k) => k === id || cols[k].some((c) => c.id === id)) ??
    null;

  const onStart = (e: DragStartEvent) => {
    const from = columnOf(String(e.active.id));
    setActive(from ? (cols[from].find((c) => c.id === e.active.id) ?? null) : null);
  };

  const onEnd = ({ active: a, over }: DragEndEvent) => {
    setActive(null);
    if (!over) return;
    const from = columnOf(String(a.id));
    const to = columnOf(String(over.id));
    if (!from || !to) return;
    const card = cols[from].find((c) => c.id === a.id)!;
    const moved = to === "review" && from !== "review" ? { ...card, who: REVIEWER } : card;
    setCols((prev) => {
      const next = { ...prev, [from]: prev[from].filter((c) => c.id !== a.id) };
      const list = [...next[to]];
      const at = list.findIndex((c) => c.id === over.id);
      list.splice(at >= 0 ? at : list.length, 0, moved);
      return { ...next, [to]: list };
    });
    if (to === "review" && from !== "review") {
      setLog(
        `${card.ref} moved to In review, so the “Review goes to Sara” rule assigned it to ${REVIEWER}.`,
      );
    }
  };

  const changed = JSON.stringify(cols) !== JSON.stringify(START);

  return (
    <div className="border-border bg-bg shadow-pop relative rounded-[18px] border p-2.5 sm:p-4">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="bg-accent size-2.5 rounded-[3px]" aria-hidden />
        <span className="text-[13px] font-semibold">Mobile App v2.0</span>
        <span className="text-subtle text-xs">Sprint 12</span>
        {changed && (
          <button
            type="button"
            onClick={() => {
              setCols(START);
              setLog(null);
            }}
            className="text-subtle hover:text-fg ml-auto text-xs underline-offset-2 hover:underline"
          >
            Reset
          </button>
        )}
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onStart}
        onDragEnd={onEnd}
        onDragCancel={() => setActive(null)}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Press space to pick up a card, use the arrow keys to move it, then press space to drop it.",
          },
        }}
      >
        <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
          {COLS.map((c) => (
            <Column key={c.id} col={c} cards={cols[c.id]} />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.2, 0.9, 0.3, 1)" }}>
          {active ? <CardView card={active} overlay /> : null}
        </DragOverlay>
      </DndContext>
      <div className="mt-3 min-h-11 px-1" aria-live="polite">
        {log ? (
          <p className="border-accent-border bg-accent-soft/60 text-fg-2 motion-safe:animate-pop flex gap-2 rounded-[10px] border px-3 py-2 text-[12.5px] leading-relaxed">
            <Zap className="text-accent-text mt-0.5 size-3.5 shrink-0" aria-hidden />
            {log}
          </p>
        ) : (
          <p className="text-subtle px-0.5 py-2 text-[12.5px]">
            Try it: drag a card into In review.
          </p>
        )}
      </div>
    </div>
  );
}
