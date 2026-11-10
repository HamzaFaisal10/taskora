"use client";

import { useActionState, useState } from "react";
import { createWorkspace, type OnboardingState } from "./actions";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/input";

const toSlug = (v: string) =>
  v
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

export function OnboardingForm({ suggestedName }: { suggestedName: string }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(
    createWorkspace,
    undefined,
  );
  const [name, setName] = useState(suggestedName);
  const [slug, setSlug] = useState(toSlug(suggestedName));
  const [slugEdited, setSlugEdited] = useState(false);

  return (
    <form action={action} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="name">Workspace name</Label>
        <Input
          id="name"
          name="name"
          value={name}
          autoFocus
          aria-invalid={state?.field === "name" || undefined}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEdited) setSlug(toSlug(e.target.value));
          }}
          placeholder="Acme Inc."
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="slug">Workspace URL</Label>
        <div
          className="border-border bg-card focus-within:border-accent rounded-control aria-[invalid=true]:border-danger flex h-10 items-center border text-sm"
          aria-invalid={state?.field === "slug" || undefined}
        >
          <span className="text-subtle pl-3 select-none">taskora.app/w/</span>
          <input
            id="slug"
            name="slug"
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value.toLowerCase());
            }}
            className="text-fg h-full min-w-0 flex-1 bg-transparent pr-3 outline-none"
            required
          />
        </div>
      </div>
      <FieldError>{state?.error}</FieldError>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Create workspace
      </Button>
    </form>
  );
}
