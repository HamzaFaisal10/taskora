import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { TaskGroup } from "@/components/tasks/task-list";
import { EmptyState } from "@/components/ui/surface";
import { myOpenTasks } from "@/lib/data/tasks";
import { getWorkspaceContext } from "@/lib/workspace";

export const metadata: Metadata = { title: "My tasks" };

export default async function MyTasksPage({ params }: PageProps<"/w/[slug]/my-tasks">) {
  const { slug } = await params;
  const { viewer, workspace } = await getWorkspaceContext(slug);
  const tasks = await myOpenTasks(workspace.id, viewer.id);
  const byProject = Map.groupBy(tasks, (t) => t.project.name);
  return (
    <>
      <PageHeader title="My tasks" description={`${tasks.length} open tasks assigned to you`} />
      {tasks.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 />}
          title="Nothing assigned to you"
          description="Tasks assigned to you across every project show up here."
        />
      ) : (
        [...byProject].map(([name, list]) => <TaskGroup key={name} title={name} tasks={list} />)
      )}
    </>
  );
}
