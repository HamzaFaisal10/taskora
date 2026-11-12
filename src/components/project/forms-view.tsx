"use client";

import { plural } from "@/lib/plural";
import { Copy, ExternalLink, FileText, GripVertical, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/controls";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { Card, EmptyState } from "@/components/ui/surface";
import {
  createForm,
  deleteForm,
  setFormPublic,
  type FormField,
} from "@/lib/project/manage-actions";
import { useProject } from "./store";

export type FormSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  isPublic: boolean;
  submissions: number;
  fields: FormField[];
};

const TYPE_LABEL: Record<FormField["type"], string> = {
  short_text: "Short answer",
  long_text: "Paragraph",
  select: "Choice",
  email: "Email",
};
const MAPS_LABEL: Record<FormField["maps_to"], string> = {
  title: "Task title",
  description: "Description",
  priority: "Priority",
  requester_email: "Requester email",
};

function FormCard({ form }: { form: FormSummary }) {
  const { basePath, canEdit } = useProject();
  const [isPublic, setPublic] = useState(form.isPublic);
  const [pending, start] = useTransition();
  const link =
    typeof window === "undefined" ? `/f/${form.slug}` : `${location.origin}/f/${form.slug}`;
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span className="bg-info-soft text-info-text rounded-control flex size-8 shrink-0 items-center justify-center">
          <FileText className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{form.title}</h3>
            {isPublic ? <Badge tone="success">Accepting answers</Badge> : <Badge>Closed</Badge>}
          </div>
          {form.description && <p className="text-muted mt-1 text-[13px]">{form.description}</p>}
          <p className="text-subtle mt-2 text-xs">
            {plural(form.fields.length, "question")} · {plural(form.submissions, "submission")} ·
            new answers land in Triage
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                navigator.clipboard
                  .writeText(`${location.origin}/f/${form.slug}`)
                  .then(() => toast.success("Form link copied"))
              }
            >
              <Copy /> Copy link
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <a href={link} target="_blank" rel="noreferrer">
                <ExternalLink /> Open form
              </a>
            </Button>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1">
            <Switch
              checked={isPublic}
              disabled={pending}
              aria-label={isPublic ? "Stop accepting answers" : "Accept answers"}
              onCheckedChange={(v) => {
                setPublic(v);
                start(async () => {
                  const res = await setFormPublic({ path: basePath, id: form.id, isPublic: v });
                  if (!res.ok) {
                    setPublic(!v);
                    toast.error(res.error);
                  }
                });
              }}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${form.title}`}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteForm({ path: basePath, id: form.id });
                  if (!res.ok) toast.error(res.error);
                  else toast.success("Form deleted");
                })
              }
            >
              <Trash2 />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

const STARTER: FormField[] = [
  { id: "q1", label: "What do you need?", type: "short_text", required: true, maps_to: "title" },
  { id: "q2", label: "Tell us more", type: "long_text", required: false, maps_to: "description" },
  { id: "q3", label: "Your email", type: "email", required: true, maps_to: "requester_email" },
];

function QuestionEditor({
  field,
  onChange,
  onRemove,
  canRemove,
}: {
  field: FormField;
  onChange: (f: FormField) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const sel = "border-border bg-card rounded-control h-9 border px-2 text-sm";
  return (
    <div className="border-border bg-surface rounded-card space-y-2 border p-3">
      <div className="flex items-center gap-2">
        <GripVertical className="text-subtle size-4 shrink-0" aria-hidden />
        <Input
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          aria-label="Question"
          placeholder="Question"
          className="h-9"
        />
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove question"
            onClick={onRemove}
          >
            <X />
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-6">
        <select
          aria-label="Answer type"
          value={field.type}
          onChange={(e) => {
            const type = e.target.value as FormField["type"];
            onChange({
              ...field,
              type,
              maps_to:
                type === "email"
                  ? "requester_email"
                  : type === "select"
                    ? "priority"
                    : field.maps_to === "requester_email" || field.maps_to === "priority"
                      ? "description"
                      : field.maps_to,
              options:
                type === "select"
                  ? (field.options ?? ["Blocking my work", "High", "Medium", "Low"])
                  : undefined,
            });
          }}
          className={sel}
        >
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <span className="text-subtle text-xs">becomes</span>
        <select
          aria-label="Saved as"
          value={field.maps_to}
          onChange={(e) => onChange({ ...field, maps_to: e.target.value as FormField["maps_to"] })}
          className={sel}
        >
          {(field.type === "email"
            ? ["requester_email"]
            : field.type === "select"
              ? ["priority", "description"]
              : ["title", "description"]
          ).map((k) => (
            <option key={k} value={k}>
              {MAPS_LABEL[k as FormField["maps_to"]]}
            </option>
          ))}
        </select>
        <label className="text-muted ml-auto flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onChange({ ...field, required: e.target.checked })}
            className="accent-[var(--accent)]"
          />
          Required
        </label>
      </div>
      {field.type === "select" && (
        <div className="pl-6">
          <Input
            value={(field.options ?? []).join(", ")}
            onChange={(e) =>
              onChange({
                ...field,
                options: e.target.value
                  .split(",")
                  .map((o) => o.trim())
                  .filter(Boolean),
              })
            }
            aria-label="Choices, separated by commas"
            placeholder="Choices, separated by commas"
            className="h-9"
          />
          {field.maps_to === "priority" && (
            <p className="text-subtle mt-1 text-xs">
              Use Blocking my work, High, Medium or Low to set the task priority.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function NewFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { project, basePath } = useProject();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FormField[]>(STARTER);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const nextId = () => `q${Math.max(0, ...fields.map((f) => Number(f.id.slice(1)))) + 1}`;
  const save = () =>
    start(async () => {
      const res = await createForm({
        path: basePath,
        projectId: project.id,
        title,
        description,
        fields,
      });
      if (!res.ok) return setError(res.error);
      toast.success("Form published");
      onOpenChange(false);
      setTitle("");
      setDescription("");
      setFields(STARTER);
      setError(undefined);
    });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>New form</DialogTitle>
          <DialogDescription>
            Anyone with the link can submit. Each answer becomes a task in {project.name}&apos;s
            Triage.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="form-title">Title</Label>
            <Input
              id="form-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Report a bug"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="form-desc">Intro</Label>
            <Textarea
              id="form-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A sentence that tells people what to expect."
            />
          </div>
          <div className="space-y-2">
            <p className="text-fg-2 text-[13px] font-medium">Questions</p>
            {fields.map((f, i) => (
              <QuestionEditor
                key={f.id}
                field={f}
                canRemove={fields.length > 1}
                onChange={(next) => setFields((list) => list.map((x, j) => (j === i ? next : x)))}
                onRemove={() => setFields((list) => list.filter((_, j) => j !== i))}
              />
            ))}
            {fields.length < 12 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setFields((l) => [
                    ...l,
                    {
                      id: nextId(),
                      label: "",
                      type: "short_text",
                      required: false,
                      maps_to: "description",
                    },
                  ])
                }
              >
                <Plus /> Add question
              </Button>
            )}
          </div>
          <FieldError>{error}</FieldError>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} loading={pending}>
            Publish form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FormsView({ forms }: { forms: FormSummary[] }) {
  const { canEdit } = useProject();
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-12 sm:px-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-base font-semibold">Forms</h2>
          <p className="text-muted text-sm">
            Collect requests from clients and teammates without giving them an account.
          </p>
        </div>
        {canEdit && (
          <Button className="ml-auto" size="sm" onClick={() => setOpen(true)}>
            <Plus /> New form
          </Button>
        )}
      </div>
      {forms.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText />}
            title="No forms yet"
            description="Publish a bug report or feature request form and share the link."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {forms.map((f) => (
            <FormCard key={f.id} form={f} />
          ))}
        </div>
      )}
      <NewFormDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
