import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { LogoMark } from "@/components/brand/logo";
import type { FormField } from "@/lib/project/manage-actions";
import { createClient } from "@/lib/supabase/server";
import { PublicForm } from "./public-form";

type PublicFormData = {
  title: string;
  description: string;
  fields: FormField[];
  workspace: string;
};

const loadForm = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_form", { p_slug: slug });
  return (data as PublicFormData | null) ?? null;
});

export async function generateMetadata({ params }: PageProps<"/f/[slug]">): Promise<Metadata> {
  const form = await loadForm((await params).slug);
  return {
    title: form ? `${form.title} · ${form.workspace}` : "Form not found",
    robots: { index: false },
  };
}

export default async function PublicFormPage({ params }: PageProps<"/f/[slug]">) {
  const { slug } = await params;
  const form = await loadForm(slug);
  if (!form) notFound();
  return (
    <main className="min-h-dvh px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-xl">
        <p className="text-muted mb-6 text-sm font-medium">{form.workspace}</p>
        <PublicForm
          slug={slug}
          title={form.title}
          description={form.description}
          fields={form.fields}
        />
        <p className="text-subtle mt-10 flex items-center justify-center gap-1.5 text-xs">
          <LogoMark size={14} variant="mono" /> Powered by Taskora
        </p>
      </div>
    </main>
  );
}
