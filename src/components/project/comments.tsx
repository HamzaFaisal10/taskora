"use client";

import { SmilePlus } from "lucide-react";
import { Fragment, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/shell/workspace-provider";
import { Avatar } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { toggleReaction } from "@/lib/project/actions";
import type { Person } from "@/lib/project/types";
import { cn } from "@/lib/utils";

const EMOJI = ["👍", "🎉", "❤️", "👀", "✅", "🚀"];

/** Comment text with "@Full Name" mentions of known people highlighted. */
export function CommentBody({ body, people }: { body: string; people: Person[] }) {
  const parts = useMemo(() => {
    const names = people
      .map((p) => p.name)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    if (!names.length || !body.includes("@")) return [body];
    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return body.split(new RegExp(`(@(?:${escaped.join("|")}))`, "gi"));
  }, [body, people]);
  return (
    <p className="text-fg-2 mt-0.5 text-sm leading-relaxed break-words whitespace-pre-wrap">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="bg-accent-soft text-accent-text rounded px-0.5 font-medium">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </p>
  );
}

export function Reactions({
  commentId,
  reactions,
  people,
  onChange,
}: {
  commentId: string;
  reactions: { emoji: string; userIds: string[] }[];
  people: Person[];
  onChange: () => void;
}) {
  const { viewer } = useWorkspace();
  const [local, setLocal] = useState(reactions);
  const [prev, setPrev] = useState(reactions);
  if (prev !== reactions) {
    setPrev(reactions);
    setLocal(reactions);
  }
  const [, start] = useTransition();
  const toggle = (emoji: string) => {
    setLocal((list) => {
      const found = list.find((r) => r.emoji === emoji);
      if (!found) return [...list, { emoji, userIds: [viewer.id] }];
      const userIds = found.userIds.includes(viewer.id)
        ? found.userIds.filter((u) => u !== viewer.id)
        : [...found.userIds, viewer.id];
      return list
        .map((r) => (r.emoji === emoji ? { ...r, userIds } : r))
        .filter((r) => r.userIds.length);
    });
    start(async () => {
      const res = await toggleReaction({ commentId, emoji });
      if (!res.ok) toast.error(res.error);
      onChange();
    });
  };
  const nameOf = (id: string) =>
    id === viewer.id ? "You" : (people.find((p) => p.id === id)?.name ?? "Someone");
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {local.map((r) => {
        const mine = r.userIds.includes(viewer.id);
        return (
          <button
            key={r.emoji}
            type="button"
            onClick={() => toggle(r.emoji)}
            title={r.userIds.map(nameOf).join(", ")}
            aria-pressed={mine}
            className={cn(
              "border-border hover:bg-elevated flex h-6 items-center gap-1 rounded-full border px-2 text-xs",
              mine && "border-accent-border bg-accent-soft/60",
            )}
          >
            <span aria-hidden>{r.emoji}</span>
            <span className="tabular-nums">{r.userIds.length}</span>
            <span className="sr-only">reactions, {mine ? "including yours" : "add yours"}</span>
          </button>
        );
      })}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="text-subtle hover:text-fg hover:bg-elevated flex size-6 items-center justify-center rounded-full"
            aria-label="Add a reaction"
          >
            <SmilePlus className="size-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="flex w-auto gap-1 p-1.5">
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => toggle(e)}
              className="hover:bg-elevated rounded-md p-1.5 text-base"
              aria-label={`React with ${e}`}
            >
              {e}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Textarea that suggests teammates after "@" and inserts "@Full Name". */
export function MentionInput({
  value,
  onChange,
  onSubmit,
  people,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  people: Person[];
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Caret position to restore right after React writes the new value (before the next keystroke).
  const caretAfter = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (caretAfter.current == null || !ref.current) return;
    ref.current.focus();
    ref.current.setSelectionRange(caretAfter.current, caretAfter.current);
    caretAfter.current = null;
  }, [value]);
  const [query, setQuery] = useState<{ start: number; text: string } | null>(null);
  const [active, setActive] = useState(0);
  const matches = query
    ? people.filter((p) => p.name.toLowerCase().includes(query.text.toLowerCase())).slice(0, 6)
    : [];

  const detect = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const m = before.match(/(^|\s)@([\p{L}\p{N} ]{0,30})$/u);
    if (m && !m[2].includes("  ")) {
      setQuery({ start: caret - m[2].length - 1, text: m[2] });
      setActive(0);
    } else setQuery(null);
  };

  const pick = (p: Person) => {
    if (!query) return;
    const caret = ref.current?.selectionStart ?? value.length;
    const next = `${value.slice(0, query.start)}@${p.name} ${value.slice(caret)}`;
    caretAfter.current = query.start + p.name.length + 2;
    onChange(next);
    setQuery(null);
  };

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          detect(e.target.value, e.target.selectionStart);
        }}
        onKeyDown={(e) => {
          if (query && matches.length) {
            if (e.key === "ArrowDown")
              return (e.preventDefault(), setActive((i) => (i + 1) % matches.length));
            if (e.key === "ArrowUp")
              return (
                e.preventDefault(),
                setActive((i) => (i - 1 + matches.length) % matches.length)
              );
            if (e.key === "Enter" || e.key === "Tab")
              return (e.preventDefault(), pick(matches[active]));
            if (e.key === "Escape") return (e.preventDefault(), setQuery(null));
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && value.trim()) onSubmit();
        }}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        rows={2}
        placeholder="Write a comment… Type @ to mention someone"
        aria-label="Write a comment"
        aria-autocomplete="list"
        aria-controls="mention-list"
        className="placeholder:text-subtle w-full resize-none bg-transparent px-1 text-sm outline-none"
      />
      {query && matches.length > 0 && (
        <ul
          id="mention-list"
          role="listbox"
          className="border-border bg-surface shadow-pop rounded-card absolute bottom-full left-0 z-20 mb-1 w-64 border p-1"
        >
          {matches.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(p);
              }}
              onMouseMove={() => setActive(i)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                i === active && "bg-elevated",
              )}
            >
              <Avatar name={p.name} src={p.avatarUrl} seed={p.id} size={20} />
              {p.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
