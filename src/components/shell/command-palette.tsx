"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  CircleCheck,
  CircleDot,
  CornerDownLeft,
  FolderKanban,
  FolderPlus,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { THEME_OPTIONS } from "@/components/theme";
import type { TaskHit } from "@/app/api/search/route";
import { cn } from "@/lib/utils";
import { workspaceNav, settingsNav } from "./nav";
import { useNewProject } from "./new-project";
import { useWorkspace } from "./workspace-provider";

type Command = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
};

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { workspace, workspaces, projects } = useWorkspace();
  const router = useRouter();
  const { setTheme } = useTheme();
  const newProject = useNewProject();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => router.push(href);
    return [
      ...(workspace.role !== "guest"
        ? [
            {
              id: "new-project",
              group: "Create",
              label: "New project",
              icon: FolderPlus,
              run: () => newProject(),
            },
          ]
        : []),
      ...workspaceNav(workspace.slug).map((n) => ({
        id: n.href,
        group: "Go to",
        label: n.label,
        icon: n.icon,
        run: go(n.href),
      })),
      ...projects.map((p) => ({
        id: p.id,
        group: "Projects",
        label: p.name,
        hint: p.key,
        icon: FolderKanban,
        run: go(`/w/${workspace.slug}/p/${p.key}`),
      })),
      ...settingsNav(workspace.slug)
        .slice(0, 1)
        .map((n) => ({
          id: `s-${n.label}`,
          group: "Go to",
          label: n.label,
          icon: n.icon,
          run: go(n.href),
        })),
      ...workspaces
        .filter((w) => w.id !== workspace.id)
        .map((w) => ({
          id: w.id,
          group: "Switch workspace",
          label: w.name,
          icon: FolderKanban,
          run: go(`/w/${w.slug}`),
        })),
      ...THEME_OPTIONS.map((t) => ({
        id: `theme-${t.value}`,
        group: "Theme",
        label: `Use ${t.label.toLowerCase()} theme`,
        icon: t.icon,
        run: () => setTheme(t.value),
      })),
    ];
  }, [workspace, workspaces, projects, router, setTheme, newProject]);

  // Tasks matching the query, fetched as you type (results for an older query are ignored).
  const [hits, setHits] = useState<{ q: string; tasks: TaskHit[] }>({ q: "", tasks: [] });
  const [searching, setSearching] = useState(false);
  const trimmed = query.trim();
  useEffect(() => {
    if (trimmed.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setSearching(true);
      fetch(`/api/search?workspace=${workspace.id}&q=${encodeURIComponent(trimmed)}`, {
        signal: ctrl.signal,
      })
        .then((r) => r.json())
        .then((d: { tasks: TaskHit[] }) => setHits({ q: trimmed, tasks: d.tasks ?? [] }))
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [trimmed, workspace.id]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    const matched = commands.filter((c) =>
      `${c.label} ${c.hint ?? ""} ${c.group}`.toLowerCase().includes(q),
    );
    const tasks: Command[] =
      hits.q === query.trim()
        ? hits.tasks.map((t) => ({
            id: `task-${t.ref}`,
            group: "Tasks",
            label: t.title,
            hint: `${t.ref} · ${t.projectName}`,
            icon: t.done ? CircleCheck : CircleDot,
            run: () => router.push(`/w/${workspace.slug}/p/${t.projectKey}?task=${t.ref}`),
          }))
        : [];
    return [...tasks, ...matched];
  }, [commands, query, hits, router, workspace.slug]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const run = (cmd?: Command) => {
    if (!cmd) return;
    onOpenChange(false);
    setQuery("");
    cmd.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(results[active]);
    }
  };

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let lastGroup = "";
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQuery("");
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bg-overlay fixed inset-0 z-50" />
        <DialogPrimitive.Content
          className="border-border bg-surface shadow-pop animate-pop rounded-dialog fixed top-[12dvh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden border"
          onKeyDown={onKeyDown}
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Command menu</DialogPrimitive.Title>
          <div className="border-border flex items-center gap-2.5 border-b px-4">
            <Search className="text-subtle size-4" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder="Search tasks, projects and pages…"
              className="text-fg placeholder:text-subtle h-12 flex-1 bg-transparent text-sm outline-none"
              role="combobox"
              aria-expanded
              aria-controls="command-list"
              aria-activedescendant={results[active] ? `cmd-${active}` : undefined}
            />
          </div>
          <div
            ref={listRef}
            id="command-list"
            role="listbox"
            className="max-h-[50dvh] overflow-y-auto p-1.5"
          >
            {results.length === 0 && (
              <p className="text-muted px-3 py-8 text-center text-sm">
                {searching || (trimmed.length >= 2 && hits.q !== trimmed)
                  ? "Searching…"
                  : `No results for “${query}”`}
              </p>
            )}
            {results.map((cmd, i) => {
              const header = cmd.group !== lastGroup ? cmd.group : null;
              lastGroup = cmd.group;
              return (
                <div key={cmd.id}>
                  {header && (
                    <div className="text-subtle px-2.5 pt-2.5 pb-1 text-[11px] font-medium tracking-wide uppercase">
                      {header}
                    </div>
                  )}
                  <div
                    id={`cmd-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={i === active}
                    onMouseMove={() => setActive(i)}
                    onClick={() => run(cmd)}
                    className={cn(
                      "flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-sm",
                      i === active && "bg-elevated",
                    )}
                  >
                    <cmd.icon className="text-muted size-4" />
                    <span className="flex-1 truncate">{cmd.label}</span>
                    {cmd.hint && (
                      <span className="text-subtle font-mono text-[11px]">{cmd.hint}</span>
                    )}
                    {i === active && (
                      <CornerDownLeft className="text-subtle size-3.5" aria-hidden />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
