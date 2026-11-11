"use client";

import {
  Calendar,
  CheckSquare,
  ChevronDown,
  Hash,
  List,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  Type,
  UserRound,
  X,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError, Input, Label } from "@/components/ui/input";
import { deleteField, saveField, setFieldValue, setRecurrence } from "@/lib/project/field-actions";
import type { CustomField, FieldKind, FieldValue, Recurrence } from "@/lib/project/types";
import { cn } from "@/lib/utils";
import { useProject } from "./store";

export const FIELD_KINDS: {
  value: FieldKind;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "text", label: "Text", icon: Type },
  { value: "number", label: "Number", icon: Hash },
  { value: "select", label: "Dropdown", icon: List },
  { value: "date", label: "Date", icon: Calendar },
  { value: "checkbox", label: "Checkbox", icon: CheckSquare },
  { value: "person", label: "Person", icon: UserRound },
];
export const fieldIcon = (kind: FieldKind) =>
  FIELD_KINDS.find((k) => k.value === kind)?.icon ?? Type;

const control =
  "hover:bg-elevated focus:bg-elevated rounded-control -ml-2 h-8 max-w-full bg-transparent px-2 text-[13px] outline-none disabled:hover:bg-transparent";

/** Editor for one custom field on one task. Saves on change (text and numbers on blur). */
export function FieldValueEditor({
  taskId,
  field,
  value,
  disabled,
  onSaved,
}: {
  taskId: string;
  field: CustomField;
  value: FieldValue | undefined;
  disabled: boolean;
  onSaved: (v: FieldValue | null) => void;
}) {
  const { people } = useProject();
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const [, start] = useTransition();

  const save = (v: FieldValue | null) => {
    if ((v ?? "") === (value ?? "")) return;
    onSaved(v);
    start(async () => {
      const res = await setFieldValue({ taskId, fieldId: field.id, value: v });
      if (!res.ok) {
        toast.error(res.error);
        onSaved(value ?? null);
        setDraft(value == null ? "" : String(value));
      }
    });
  };

  const empty = value == null || value === "";
  switch (field.kind) {
    case "checkbox":
      return (
        <input
          type="checkbox"
          checked={value === true}
          disabled={disabled}
          aria-label={field.name}
          onChange={(e) => save(e.target.checked ? true : null)}
          className="accent-accent size-4"
        />
      );
    case "select":
      return (
        <select
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          aria-label={field.name}
          onChange={(e) => save(e.target.value || null)}
          className={cn(control, "px-1.5", empty && "text-subtle")}
        >
          <option value="">Empty</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "person":
      return (
        <select
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          aria-label={field.name}
          onChange={(e) => save(e.target.value || null)}
          className={cn(control, "px-1.5", empty && "text-subtle")}
        >
          <option value="">Nobody</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      );
    case "date":
      return (
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={typeof value === "string" ? value : ""}
            disabled={disabled}
            aria-label={field.name}
            onChange={(e) => save(e.target.value || null)}
            className={cn(control, "[color-scheme:light_dark]", empty && "text-subtle")}
          />
          {!empty && !disabled && (
            <button
              type="button"
              onClick={() => save(null)}
              className="text-subtle hover:text-fg rounded p-1"
              aria-label={`Clear ${field.name}`}
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      );
    default: {
      const isNumber = field.kind === "number";
      return (
        <input
          type={isNumber ? "number" : "text"}
          inputMode={isNumber ? "decimal" : undefined}
          value={draft}
          disabled={disabled}
          aria-label={field.name}
          placeholder="Empty"
          maxLength={500}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const t = draft.trim();
            if (!t) return save(null);
            if (isNumber) {
              const n = Number(t);
              if (!Number.isFinite(n)) {
                toast.error("Enter a number.");
                return setDraft(value == null ? "" : String(value));
              }
              return save(n);
            }
            save(t);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={cn(control, "w-full placeholder:text-[var(--subtle)]")}
        />
      );
    }
  }
}

const REPEATS: { label: string; value: Recurrence | null }[] = [
  { label: "Doesn't repeat", value: null },
  { label: "Every day", value: { freq: "daily", interval: 1 } },
  { label: "Every weekday", value: { freq: "weekdays", interval: 1 } },
  { label: "Every week", value: { freq: "weekly", interval: 1 } },
  { label: "Every 2 weeks", value: { freq: "weekly", interval: 2 } },
  { label: "Every month", value: { freq: "monthly", interval: 1 } },
];
const repeatKey = (r: Recurrence | null) => (r ? `${r.freq}:${r.interval ?? 1}` : "");

export function RepeatField({
  taskId,
  value,
  disabled,
  onSaved,
}: {
  taskId: string;
  value: Recurrence | null;
  disabled: boolean;
  onSaved: (r: Recurrence | null) => void;
}) {
  const { refresh } = useProject();
  const [, start] = useTransition();
  const current = repeatKey(value);
  const known = REPEATS.some((r) => repeatKey(r.value) === current);
  return (
    <div className="flex items-center gap-1.5">
      <select
        value={current}
        disabled={disabled}
        aria-label="Repeat"
        onChange={(e) => {
          const next = REPEATS.find((r) => repeatKey(r.value) === e.target.value)?.value ?? null;
          onSaved(next);
          start(async () => {
            const res = await setRecurrence({ taskId, recurrence: next });
            if (!res.ok) {
              toast.error(res.error);
              onSaved(value);
              return;
            }
            refresh();
            if (next) toast.success("When this is done, the next one is created for you");
          });
        }}
        className={cn(control, "px-1.5", !value && "text-subtle")}
      >
        {!known && <option value={current}>Custom</option>}
        {REPEATS.map((r) => (
          <option key={r.label} value={repeatKey(r.value)}>
            {r.label}
          </option>
        ))}
      </select>
      {value && <Repeat className="text-accent-text size-3.5" aria-hidden />}
    </div>
  );
}

function FieldForm({ field, onDone }: { field?: CustomField; onDone: () => void }) {
  const { project, refresh } = useProject();
  const [name, setName] = useState(field?.name ?? "");
  const [kind, setKind] = useState<FieldKind>(field?.kind ?? "text");
  const [options, setOptions] = useState(field?.options.join("\n") ?? "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <form
      className="border-border-subtle bg-surface rounded-card space-y-3 border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveField({
            projectId: project.id,
            id: field?.id,
            name,
            kind,
            options: options
              .split(/\n|,/)
              .map((o) => o.trim())
              .filter(Boolean),
          });
          if (!res.ok) return setError(res.error);
          toast.success(field ? "Field updated" : `Added ${name.trim()}`);
          refresh();
          onDone();
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <div className="space-y-1.5">
          <Label htmlFor="field-name">Name</Label>
          <Input
            id="field-name"
            value={name}
            autoFocus
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="Client, Budget, Platform…"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="field-kind">Type</Label>
          <div className="relative">
            <select
              id="field-kind"
              value={kind}
              disabled={!!field}
              onChange={(e) => setKind(e.target.value as FieldKind)}
              className="border-border bg-card rounded-control h-10 w-full appearance-none border pr-8 pl-3 text-sm disabled:opacity-60"
            >
              {FIELD_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <ChevronDown className="text-subtle pointer-events-none absolute top-3 right-2.5 size-4" />
          </div>
        </div>
      </div>
      {kind === "select" && (
        <div className="space-y-1.5">
          <Label htmlFor="field-options">Options, one per line</Label>
          <textarea
            id="field-options"
            value={options}
            rows={4}
            onChange={(e) => setOptions(e.target.value)}
            placeholder={"Acme Corp\nNorthwind\nInternal"}
            className="border-border bg-card focus:border-accent rounded-control w-full border px-3 py-2 text-sm outline-none"
          />
        </div>
      )}
      <FieldError>{error}</FieldError>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={pending} disabled={!name.trim()}>
          {field ? "Save field" : "Add field"}
        </Button>
      </div>
    </form>
  );
}

/** Add, rename and delete a project's custom fields. */
export function FieldsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { fields, refresh } = useProject();
  const [editing, setEditing] = useState<string | "new" | null>(fields.length ? null : "new");
  const [pending, start] = useTransition();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Custom fields</DialogTitle>
          <DialogDescription>
            Extra details every task in this project can have, like a client or a budget.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-2">
          {fields.length === 0 && editing !== "new" && (
            <p className="text-subtle text-sm">No custom fields yet.</p>
          )}
          {fields.map((f) => {
            const Icon = fieldIcon(f.kind);
            if (editing === f.id)
              return <FieldForm key={f.id} field={f} onDone={() => setEditing(null)} />;
            return (
              <div
                key={f.id}
                className="border-border-subtle flex items-center gap-3 rounded-[10px] border px-3 py-2"
              >
                <Icon className="text-subtle size-4 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <p className="text-subtle truncate text-xs">
                    {FIELD_KINDS.find((k) => k.value === f.kind)?.label}
                    {f.kind === "select" && f.options.length > 0 && `: ${f.options.join(", ")}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${f.name}`}
                  onClick={() => setEditing(f.id)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${f.name}`}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await deleteField({ id: f.id });
                      if (!res.ok) return void toast.error(res.error);
                      toast.success(`Deleted ${f.name} and its values`);
                      refresh();
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            );
          })}
          {editing === "new" ? (
            <FieldForm onDone={() => setEditing(null)} />
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setEditing("new")}>
              <Plus /> Add field
            </Button>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
