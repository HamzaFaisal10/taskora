"use client";

import {
  Archive,
  CalendarDays,
  Columns3,
  FileText,
  GanttChart,
  List,
  ListFilter,
  MoreHorizontal,
  Pencil,
  Plus,
  Rocket,
  Search,
  Star,
  Workflow,
  X,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ProjectDialog } from "@/components/shell/new-project";
import { PlanDialog } from "./plan-dialog";
import { ColumnsDialog } from "./columns-dialog";
import { FieldsDialog } from "./custom-fields";
import { useWorkspace } from "@/components/shell/workspace-provider";
import { archiveProject, setFavorite } from "@/lib/project/project-actions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PRIORITY_META, PriorityIcon, type Priority } from "@/components/tasks/task-meta";
import { cn } from "@/lib/utils";
import { useProject } from "./store";

const VIEWS = [
  { slug: "", label: "Board", icon: Columns3 },
  { slug: "list", label: "List", icon: List },
  { slug: "calendar", label: "Calendar", icon: CalendarDays },
  { slug: "timeline", label: "Timeline", icon: GanttChart },
  { slug: "sprints", label: "Sprints", icon: Rocket },
  { slug: "automations", label: "Automations", icon: Workflow },
  { slug: "forms", label: "Forms", icon: FileText },
];

// Search and filters only make sense on the task views.
const TASK_VIEWS = new Set(["", "list", "calendar", "timeline"]);

function toggle(list: string[], v: string) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function FilterMenu() {
  const { filters, setFilters, people, labels, activeFilterCount } = useProject();
  const count = activeFilterCount - (filters.q ? 1 : 0);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className={cn(count > 0 && "border-accent-border text-accent-text")}
        >
          <ListFilter /> Filter{count > 0 && ` · ${count}`}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70dvh] w-60 overflow-y-auto">
        <DropdownMenuLabel>Assignee</DropdownMenuLabel>
        {[{ id: "none", name: "Unassigned", avatarUrl: null }, ...people].map((p) => (
          <DropdownMenuCheckboxItem
            key={p.id}
            checked={filters.assignees.includes(p.id)}
            onSelect={(e) => {
              e.preventDefault();
              setFilters({ ...filters, assignees: toggle(filters.assignees, p.id) });
            }}
          >
            {p.id !== "none" && <Avatar name={p.name} src={p.avatarUrl} seed={p.id} size={16} />}
            <span className="truncate">{p.name}</span>
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Priority</DropdownMenuLabel>
        {(["urgent", "high", "medium", "low", "none"] as Priority[]).map((p) => (
          <DropdownMenuCheckboxItem
            key={p}
            checked={filters.priorities.includes(p)}
            onSelect={(e) => {
              e.preventDefault();
              setFilters({ ...filters, priorities: toggle(filters.priorities, p) });
            }}
          >
            <PriorityIcon priority={p} /> {PRIORITY_META[p].label}
          </DropdownMenuCheckboxItem>
        ))}
        {labels.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Label</DropdownMenuLabel>
            {labels.map((l) => (
              <DropdownMenuCheckboxItem
                key={l.id}
                checked={filters.labels.includes(l.id)}
                onSelect={(e) => {
                  e.preventDefault();
                  setFilters({ ...filters, labels: toggle(filters.labels, l.id) });
                }}
              >
                {l.name}
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}
        {count > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => setFilters({ ...filters, assignees: [], priorities: [], labels: [] })}
            >
              <X /> Clear filters
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NewTaskDialog() {
  const { create, statuses, openTask, canEdit } = useProject();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  if (!canEdit) return null;
  const firstOpen = statuses.find((s) => s.category === "unstarted") ?? statuses[0];
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    const ref = await create(title.trim(), { statusId: firstOpen?.id });
    setBusy(false);
    if (ref) {
      setOpen(false);
      setTitle("");
      openTask(ref);
    }
  };
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> New task
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="md">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>New task</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                aria-label="Task title"
              />
              <p className="text-subtle mt-2 text-xs">
                Added to {firstOpen?.name}. You can set the assignee, dates and labels next.
              </p>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy} disabled={!title.trim()}>
                Create task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProjectMenu() {
  const { project, canEdit } = useProject();
  const { workspace, projects } = useWorkspace();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [columns, setColumns] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [pending, start] = useTransition();
  const favorite = projects.find((p) => p.id === project.id)?.favorite ?? false;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Project options" disabled={pending}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            onSelect={() =>
              start(async () => {
                const res = await setFavorite({
                  slug: workspace.slug,
                  projectId: project.id,
                  favorite: !favorite,
                });
                if (!res.ok) toast.error(res.error);
              })
            }
          >
            <Star className={cn(favorite && "!text-warning fill-current")} />{" "}
            {favorite ? "Remove from favorites" : "Add to favorites"}
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <Pencil /> Edit project
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem onSelect={() => setColumns(true)}>
              <Columns3 /> Edit board columns
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem onSelect={() => setFieldsOpen(true)}>
              <SlidersHorizontal /> Custom fields
            </DropdownMenuItem>
          )}
          {canEdit && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                onSelect={() =>
                  start(async () => {
                    const res = await archiveProject({
                      slug: workspace.slug,
                      projectId: project.id,
                    });
                    if (!res.ok) return void toast.error(res.error);
                    toast.success(`${project.name} archived`);
                    router.push(`/w/${workspace.slug}`);
                  })
                }
              >
                <Archive /> Archive project
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {editing && <ProjectDialog open={editing} onOpenChange={setEditing} project={project} />}
      {columns && <ColumnsDialog open={columns} onOpenChange={setColumns} />}
      {fieldsOpen && <FieldsDialog open={fieldsOpen} onOpenChange={setFieldsOpen} />}
    </>
  );
}

function PlanButton() {
  const { canEdit } = useProject();
  const [open, setOpen] = useState(false);
  if (!canEdit) return null;
  return (
    <>
      <Button variant="ai" size="sm" onClick={() => setOpen(true)}>
        <Sparkles /> <span className="hidden sm:inline">Plan with AI</span>
        <span className="sr-only sm:hidden">Plan tasks with AI</span>
      </Button>
      {open && <PlanDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}

export function ProjectToolbar() {
  const { project, basePath, filters, setFilters, allTasks, tasks } = useProject();
  const pathname = usePathname();
  const current = pathname.replace(basePath, "").replace(/^\//, "");

  return (
    <div className="border-border bg-bg sticky top-12 z-20 border-b lg:top-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-4 sm:px-8">
        <h1 className="flex min-w-0 items-center gap-2.5 text-lg font-semibold tracking-tight">
          <span
            className="size-3.5 shrink-0 rounded-[4px]"
            style={{ background: project.color }}
            aria-hidden
          />
          <span className="truncate">{project.name}</span>
          <span className="text-subtle font-mono text-xs font-normal">{project.key}</span>
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <ProjectMenu />
          <PlanButton />
          <NewTaskDialog />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-2 sm:px-8">
        <nav
          aria-label="Project views"
          className="-mx-1 -mb-2 flex [scrollbar-width:none] overflow-x-auto overflow-y-hidden pb-2 [&::-webkit-scrollbar]:hidden"
        >
          {VIEWS.map((v) => {
            const active = current === v.slug;
            return (
              <Link
                key={v.label}
                href={v.slug ? `${basePath}/${v.slug}` : basePath}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-muted hover:text-fg relative flex h-9 items-center gap-1.5 px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors [&_svg]:size-4",
                  active &&
                    "text-fg after:bg-accent after:absolute after:inset-x-2 after:-bottom-0 after:h-0.5 after:rounded-full",
                )}
              >
                <v.icon aria-hidden />
                {v.label}
              </Link>
            );
          })}
        </nav>
        {TASK_VIEWS.has(current) && (
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search
                className="text-subtle pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
                aria-hidden
              />
              <input
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                placeholder="Search tasks"
                aria-label="Search tasks"
                className="border-border bg-card focus:border-accent rounded-control h-8 w-36 border pr-2 pl-8 text-[13px] outline-none sm:w-48"
              />
            </div>
            <FilterMenu />
          </div>
        )}
      </div>
      {TASK_VIEWS.has(current) && tasks.length !== allTasks.length && (
        <p className="text-subtle px-4 pb-2 text-xs sm:px-8">
          Showing {tasks.length} of {allTasks.length} tasks
        </p>
      )}
    </div>
  );
}
