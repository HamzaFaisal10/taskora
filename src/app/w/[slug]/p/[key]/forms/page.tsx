import { FormsView, type FormSummary } from "@/components/project/forms-view";
import { getProjectData } from "@/lib/project/data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Forms" };

export default async function FormsPage({ params }: PageProps<"/w/[slug]/p/[key]/forms">) {
  const { slug, key } = await params;
  const { project } = await getProjectData(slug, key);
  const supabase = await createClient();
  const { data } = await supabase
    .from("forms")
    .select("id, slug, title, description, is_public, submission_count, fields")
    .eq("project_id", project.id)
    .order("created_at");
  type Row = {
    id: string;
    slug: string;
    title: string;
    description: string;
    is_public: boolean;
    submission_count: number;
    fields: FormSummary["fields"];
  };
  const forms: FormSummary[] = ((data ?? []) as Row[]).map((f) => ({
    id: f.id,
    slug: f.slug,
    title: f.title,
    description: f.description,
    isPublic: f.is_public,
    submissions: f.submission_count,
    fields: f.fields,
  }));
  return <FormsView forms={forms} />;
}
