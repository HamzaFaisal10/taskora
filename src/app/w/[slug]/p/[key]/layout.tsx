import type { Metadata } from "next";
import { ProjectProvider } from "@/components/project/store";
import { TaskPanel } from "@/components/project/task-panel";
import { ProjectToolbar } from "@/components/project/toolbar";
import { getProjectData } from "@/lib/project/data";

export async function generateMetadata({
  params,
}: LayoutProps<"/w/[slug]/p/[key]">): Promise<Metadata> {
  const { slug, key } = await params;
  const data = await getProjectData(slug, key);
  return { title: data.project.name };
}

export default async function ProjectLayout({
  children,
  params,
}: LayoutProps<"/w/[slug]/p/[key]">) {
  const { slug, key } = await params;
  const data = await getProjectData(slug, key);
  return (
    <ProjectProvider data={data} basePath={`/w/${slug}/p/${data.project.key}`}>
      <ProjectToolbar />
      {children}
      <TaskPanel />
    </ProjectProvider>
  );
}
