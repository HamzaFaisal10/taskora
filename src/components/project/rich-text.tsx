"use client";

import {
  Bold,
  Code,
  Heading2,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Strikethrough,
} from "lucide-react";
import { Fragment, useLayoutEffect, useRef, useState } from "react";
import {
  continueList,
  insertLink,
  parseRichText,
  prefixLines,
  toggleChecklistLine,
  wrapSelection,
  type Edit,
  type Inline,
} from "@/lib/rich-text";
import { cn } from "@/lib/utils";

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case "text":
            return <Fragment key={i}>{n.v}</Fragment>;
          case "bold":
            return (
              <strong key={i} className="text-fg font-semibold">
                <Inlines nodes={n.c} />
              </strong>
            );
          case "italic":
            return (
              <em key={i}>
                <Inlines nodes={n.c} />
              </em>
            );
          case "strike":
            return (
              <s key={i} className="text-subtle">
                <Inlines nodes={n.c} />
              </s>
            );
          case "code":
            return (
              <code
                key={i}
                className="bg-surface-2 border-border-subtle rounded border px-1 py-px font-mono text-[0.85em]"
              >
                {n.v}
              </code>
            );
          case "link":
            return (
              <a
                key={i}
                href={n.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                onClick={(e) => e.stopPropagation()}
                className="text-accent-text underline underline-offset-2 hover:no-underline"
              >
                <Inlines nodes={n.c} />
              </a>
            );
        }
      })}
    </>
  );
}

/** Renders the safe Markdown subset as React elements (never as HTML). */
export function RichText({
  source,
  onToggleCheck,
  className,
}: {
  source: string;
  onToggleCheck?: (line: number) => void;
  className?: string;
}) {
  const blocks = parseRichText(source);
  return (
    <div className={cn("space-y-2 text-sm leading-relaxed", className)}>
      {blocks.map((b, i) => {
        if (b.t === "p")
          return (
            <p key={i} className="whitespace-pre-wrap">
              <Inlines nodes={b.c} />
            </p>
          );
        if (b.t === "h")
          return (
            <h4 key={i} className="text-fg pt-1 text-[0.95rem] font-semibold">
              <Inlines nodes={b.c} />
            </h4>
          );
        if (b.t === "quote")
          return (
            <blockquote key={i} className="border-border text-muted border-l-2 pl-3">
              <Inlines nodes={b.c} />
            </blockquote>
          );
        if (b.t === "ul")
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {b.items.map((item, j) => (
                <li key={j}>
                  <Inlines nodes={item} />
                </li>
              ))}
            </ul>
          );
        if (b.t === "ol")
          return (
            <ol key={i} className="list-decimal space-y-1 pl-5">
              {b.items.map((item, j) => (
                <li key={j}>
                  <Inlines nodes={item} />
                </li>
              ))}
            </ol>
          );
        return (
          <ul key={i} className="space-y-1">
            {b.items.map((item) => (
              <li key={item.line} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={item.done}
                  disabled={!onToggleCheck}
                  onChange={() => onToggleCheck?.(item.line)}
                  onClick={(e) => e.stopPropagation()}
                  className="accent-accent mt-[0.3em] size-3.5 shrink-0"
                  aria-label="Checklist item done"
                />
                <span className={cn(item.done && "text-subtle line-through")}>
                  <Inlines nodes={item.c} />
                </span>
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

type Tool = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  key?: string;
  apply: (e: Edit) => Edit;
};

const TOOLS: Tool[] = [
  { label: "Bold", icon: Bold, key: "b", apply: (e) => wrapSelection(e, "**", "bold text") },
  { label: "Italic", icon: Italic, key: "i", apply: (e) => wrapSelection(e, "*", "italic text") },
  {
    label: "Strikethrough",
    icon: Strikethrough,
    apply: (e) => wrapSelection(e, "~~", "struck text"),
  },
  { label: "Code", icon: Code, key: "e", apply: (e) => wrapSelection(e, "`", "code") },
  { label: "Heading", icon: Heading2, apply: (e) => prefixLines(e, "## ") },
  { label: "Bulleted list", icon: List, apply: (e) => prefixLines(e, "- ") },
  { label: "Numbered list", icon: ListOrdered, apply: (e) => prefixLines(e, "1. ") },
  { label: "Checklist", icon: ListChecks, apply: (e) => prefixLines(e, "- [ ] ") },
  { label: "Link", icon: Link2, key: "k", apply: insertLink },
];

/**
 * Task description: shows formatted text, and turns into a plain-text editor with a formatting
 * toolbar when clicked. Saves when focus leaves the editor; Escape cancels.
 */
export function DescriptionEditor({
  value,
  onCommit,
  disabled,
  placeholder,
}: {
  value: string;
  onCommit: (v: string) => void;
  disabled?: boolean;
  placeholder: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    if (!editing) setDraft(value);
  }
  const ref = useRef<HTMLTextAreaElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const pendingSelection = useRef<[number, number] | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 96)}px`;
    if (pendingSelection.current) {
      el.setSelectionRange(...pendingSelection.current);
      pendingSelection.current = null;
    }
  }, [draft, editing]);

  const start = () => {
    if (disabled) return;
    setDraft(value);
    pendingSelection.current = [value.length, value.length];
    setEditing(true);
    requestAnimationFrame(() => ref.current?.focus());
  };

  const finish = (save: boolean) => {
    setEditing(false);
    if (save && draft !== value) onCommit(draft);
    else setDraft(value);
  };

  const apply = (fn: (e: Edit) => Edit | null) => {
    const el = ref.current;
    if (!el) return false;
    const next = fn({ text: draft, start: el.selectionStart, end: el.selectionEnd });
    if (!next) return false;
    pendingSelection.current = [next.start, next.end];
    setDraft(next.text);
    return true;
  };

  if (!editing) {
    const empty = !value.trim();
    return (
      <div
        role={disabled ? undefined : "button"}
        tabIndex={disabled ? undefined : 0}
        aria-label={disabled ? undefined : "Edit description"}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a,input")) return;
          start();
        }}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            start();
          }
        }}
        className={cn(
          "text-fg-2 rounded-control -mx-2 min-h-20 px-2 py-1.5",
          !disabled && "hover:bg-surface focus-visible:bg-surface cursor-text",
        )}
      >
        {empty ? (
          <p className="text-subtle text-sm">{disabled ? "No description." : placeholder}</p>
        ) : (
          <RichText
            source={value}
            onToggleCheck={
              disabled ? undefined : (line) => onCommit(toggleChecklistLine(value, line))
            }
          />
        )}
      </div>
    );
  }

  const mod = isMac() ? "⌘" : "Ctrl+";
  return (
    <div
      ref={wrap}
      data-escape-local
      className="border-border bg-surface focus-within:border-accent rounded-control -mx-2 border"
      onBlur={(e) => {
        if (!wrap.current?.contains(e.relatedTarget as Node | null)) finish(true);
      }}
    >
      <div
        role="toolbar"
        aria-label="Formatting"
        className="border-border-subtle flex flex-wrap items-center gap-0.5 border-b px-1 py-1"
      >
        {TOOLS.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.key ? `${t.label} (${mod}${t.key.toUpperCase()})` : t.label}
            aria-label={t.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              apply(t.apply);
              ref.current?.focus();
            }}
            className="text-muted hover:text-fg hover:bg-surface-2 focus-visible:ring-accent grid size-7 place-items-center rounded outline-none focus-visible:ring-2"
          >
            <t.icon className="size-3.5" />
          </button>
        ))}
        <span className="text-subtle ml-auto hidden px-2 text-[11px] sm:inline">
          Markdown works too · Esc to cancel
        </span>
      </div>
      <textarea
        ref={ref}
        value={draft}
        aria-label="Description"
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            finish(false);
            return;
          }
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            finish(true);
            return;
          }
          if (e.metaKey || e.ctrlKey) {
            const tool = TOOLS.find((t) => t.key === e.key.toLowerCase());
            if (tool && !e.shiftKey && !e.altKey) {
              e.preventDefault();
              apply(tool.apply);
            }
            return;
          }
          if (e.key === "Enter" && !e.shiftKey && apply(continueList)) e.preventDefault();
        }}
        className="text-fg-2 block w-full resize-none bg-transparent px-2.5 py-2 font-mono text-[13px] leading-relaxed outline-none"
      />
    </div>
  );
}
