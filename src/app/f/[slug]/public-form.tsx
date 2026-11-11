"use client";

import { CheckCircle2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/surface";
import { submitPublicForm, type FormField } from "@/lib/project/manage-actions";

export function PublicForm({
  slug,
  title,
  description,
  fields,
}: {
  slug: string;
  title: string;
  description: string;
  fields: FormField[];
}) {
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (sent) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle2 className="text-success mx-auto size-10" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold">Thanks, we got it</h1>
        <p className="text-muted mt-2 text-sm">
          Your request is now <span className="text-fg font-mono">{sent}</span>. The team will
          follow up by email.
        </p>
        <Button variant="secondary" className="mt-6" onClick={() => setSent(null)}>
          Send another
        </Button>
      </Card>
    );
  }

  const submit = (form: FormData) => {
    const answers: Record<string, string> = {};
    for (const f of fields) answers[f.id] = String(form.get(f.id) ?? "");
    start(async () => {
      const res = await submitPublicForm(slug, answers);
      if (!res.ok) return setError(res.error);
      setError(undefined);
      setSent(res.data.ref);
    });
  };

  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-muted mt-2 text-sm leading-relaxed">{description}</p>}
      <form action={submit} className="mt-6 space-y-5">
        {fields.map((f) => (
          <div key={f.id} className="space-y-1.5">
            <Label htmlFor={f.id}>
              {f.label}
              {f.required && <span className="text-danger-text"> *</span>}
            </Label>
            {f.type === "long_text" ? (
              <Textarea id={f.id} name={f.id} required={f.required} rows={4} />
            ) : f.type === "select" ? (
              <select
                id={f.id}
                name={f.id}
                required={f.required}
                defaultValue=""
                className="border-border bg-card rounded-control h-10 w-full border px-2.5 text-sm"
              >
                <option value="" disabled>
                  Choose one
                </option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={f.id}
                name={f.id}
                type={f.type === "email" ? "email" : "text"}
                required={f.required}
                autoComplete={f.type === "email" ? "email" : undefined}
              />
            )}
          </div>
        ))}
        <FieldError>{error}</FieldError>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          Send
        </Button>
      </form>
    </Card>
  );
}
