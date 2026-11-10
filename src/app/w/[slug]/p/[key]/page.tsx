import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListTodo } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { TaskGroup } from "@/components/tasks/task-list";
import { EmptyState } from "@/components/ui/surface";
import { projectTasks } from "@/lib/data/tasks";
import { getWorkspaceContext } from "@/lib/workspace";

export async function generateMetadata({
  params,
}: PageProps<"/w/[slug]/p/[key]">): Promise<Metadata> {
  const { slug, key } = await params;
  const { projects } = await getWorkspaceContext(slug);
  return { title: projects.find((p) => p.key === key.toUpperCase())?.name ?? "Project" };
}

export default async function ProjectPage({ params }: PageProps<"/w/[slug]/p/[key]">) {
  const { slug, key } = await params;
  const { projects } = await getWorkspaceContext(slug);
  const project = projects.find((p) => p.key === key.toUpperCase());
  if (!project) notFound();
  const tasks = await projectTasks(project.id);
  const groups = [...Map.groupBy(tasks, (t) => t.status.name)];
  return (
    <>
      <PageHeader
        eyebrow={<span className="font-mono">{project.key}</span>}
        title={
          <span className="flex items-center gap-2.5">
            <span
              className="size-3.5 rounded-[4px]"
              style={{ background: project.color }}
              aria-hidden
            />
            {project.name}
          </span>
        }
        description={`${tasks.length} tasks`}
      />
      {tasks.length === 0 ? (
        <EmptyState
          icon={<ListTodo />}
          title="No tasks yet"
          description="Tasks in this project will appear here."
        />
      ) : (
        groups.map(([name, list]) => (
          <TaskGroup
            key={name}
            title={name}
            color={list[0].status.color}
            category={list[0].status.category}
            tasks={list}
          />
        ))
      )}
    </>
  );
}
