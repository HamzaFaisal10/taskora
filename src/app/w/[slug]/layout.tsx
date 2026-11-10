import { AppShell } from "@/components/shell/app-shell";
import { getWorkspaceContext } from "@/lib/workspace";

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/w/[slug]">) {
  const { slug } = await params;
  const ctx = await getWorkspaceContext(slug);
  return (
    <div className="flex min-h-dvh flex-col">
      <AppShell value={ctx}>{children}</AppShell>
    </div>
  );
}
