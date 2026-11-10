import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { Avatar } from "@/components/ui/avatar";
import { PriorityIcon, StatusDot, type StatusGroup } from "@/components/tasks/task-meta";
import type { TaskListItem } from "@/lib/data/tasks";
import { cn } from "@/lib/utils";

const toGroup = (category: string): StatusGroup =>
  category === "triage" ? "backlog" : (category as StatusGroup);

export function DueLabel({ date, done }: { date: string | null; done?: boolean }) {
  if (!date) return null;
  const d = parseISO(date);
  const diff = differenceInCalendarDays(d, new Date());
  const label =
    diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : format(d, "MMM d");
  return (
    <span
      className={cn(
        "text-muted text-xs tabular-nums",
        !done && diff < 0 && "text-danger-text",
        !done && diff === 0 && "text-warning-text",
      )}
    >
      {label}
    </span>
  );
}

export function TaskRow({
  task,
  showProject = false,
}: {
  task: TaskListItem;
  showProject?: boolean;
}) {
  const done = task.status.category === "completed" || task.status.category === "canceled";
  return (
    <li className="border-border-subtle hover:bg-surface flex h-11 items-center gap-3 border-b px-4 text-sm sm:px-8">
      <PriorityIcon priority={task.priority} />
      <span className="text-subtle w-16 shrink-0 font-mono text-[11px]">{task.ref}</span>
      <StatusDot color={task.status.color} group={toGroup(task.status.category)} />
      <span className={cn("min-w-0 flex-1 truncate", done && "text-muted line-through")}>
        {task.title}
      </span>
      {showProject && (
        <span className="text-muted hidden items-center gap-1.5 text-xs sm:flex">
          <span
            className="size-2 rounded-[2px]"
            style={{ background: task.project.color }}
            aria-hidden
          />
          {task.project.name}
        </span>
      )}
      <DueLabel date={task.dueDate} done={done} />
      {task.assignee ? (
        <Avatar
          name={task.assignee.name}
          src={task.assignee.avatarUrl}
          seed={task.assignee.id}
          size={22}
        />
      ) : (
        <span
          className="border-border size-[22px] rounded-full border border-dashed"
          aria-label="Unassigned"
        />
      )}
    </li>
  );
}

export function TaskGroup({
  title,
  color,
  category,
  tasks,
  showProject,
}: {
  title: string;
  color?: string;
  category?: string;
  tasks: TaskListItem[];
  showProject?: boolean;
}) {
  if (tasks.length === 0) return null;
  return (
    <section>
      <h2 className="bg-surface border-border sticky top-12 z-10 flex h-9 items-center gap-2 border-b px-4 text-[13px] font-medium sm:px-8 lg:top-0">
        {color && category && <StatusDot color={color} group={toGroup(category)} />}
        {title}
        <span className="text-subtle">{tasks.length}</span>
      </h2>
      <ul>
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} showProject={showProject} />
        ))}
      </ul>
    </section>
  );
}
