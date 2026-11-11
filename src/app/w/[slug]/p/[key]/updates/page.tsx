import { UpdatesView, type ProjectUpdate } from "@/components/project/updates-view";
import { getProjectData } from "@/lib/project/data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Updates" };

export default async function UpdatesPage({ params }: PageProps<"/w/[slug]/p/[key]/updates">) {
  const { slug, key } = await params;
  const data = await getProjectData(slug, key);
  const supabase = await createClient();
  const [{ data: rows }, { data: auth }] = await Promise.all([
    supabase
      .from("project_updates")
      .select("id, health, body, created_at, author_id, profiles(full_name)")
      .eq("project_id", data.project.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.auth.getUser(),
  ]);
  type Row = {
    id: string;
    health: ProjectUpdate["health"];
    body: string;
    created_at: string;
    author_id: string | null;
    profiles: { full_name: string } | null;
  };
  const updates: ProjectUpdate[] = ((rows ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    health: r.health,
    body: r.body,
    createdAt: r.created_at,
    authorId: r.author_id,
    authorName: r.profiles?.full_name ?? "Someone",
  }));
  return <UpdatesView updates={updates} viewerId={auth.user?.id ?? null} />;
}
