"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition } from "react";
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
import { FieldError, Input, Label, Textarea } from "@/components/ui/input";
import { createProject, updateProject } from "@/lib/project/project-actions";
import { PROJECT_COLORS, suggestKey, TEMPLATES, type TemplateId } from "@/lib/project/templates";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./workspace-provider";

const Ctx = createContext<() => void>(() => {});
export const useNewProject = () => useContext(Ctx);

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
      {PROJECT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={cn(
            "flex size-7 items-center justify-center rounded-[7px] ring-offset-2 ring-offset-[var(--surface)]",
            value === c && "ring-fg ring-2",
          )}
          style={{ background: c }}
        >
          {value === c && <Check className="size-3.5 text-[#0E0F11]" aria-hidden />}
        </button>
      ))}
    </div>
  );
}

export function ProjectDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Pass a project to edit it; leave empty to create one. */
  project?: { id: string; name: string; color: string; description: string; key: string };
}) {
  const { workspace } = useWorkspace();
  const router = useRouter();
  const [name, setName] = useState(project?.name ?? "");
  const [key, setKey] = useState(project?.key ?? "");
  const [keyEdited, setKeyEdited] = useState(Boolean(project));
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[1]);
  const [description, setDescription] = useState(project?.description ?? "");
  const [template, setTemplate] = useState<TemplateId>("software");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      if (project) {
        const res = await updateProject({
          slug: workspace.slug,
          projectId: project.id,
          name,
          color,
          description,
        });
        if (!res.ok) return setError(res.error);
        toast.success("Project updated");
        onOpenChange(false);
        return;
      }
      const res = await createProject({
        slug: workspace.slug,
        name,
        key: key || suggestKey(name),
        color,
        description,
        template,
      });
      if (!res.ok) return setError(res.error);
      toast.success(`${name} created`);
      onOpenChange(false);
      setName("");
      setKey("");
      setKeyEdited(false);
      setDescription("");
      router.push(`/w/${workspace.slug}/p/${res.data.key}`);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
            {!project && (
              <DialogDescription>
                Projects hold tasks, sprints, forms and automations.
              </DialogDescription>
            )}
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <div className="space-y-1.5">
                <Label htmlFor="project-name">Name</Label>
                <Input
                  id="project-name"
                  autoFocus
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!keyEdited) setKey(suggestKey(e.target.value));
                  }}
                  placeholder="e.g. Mobile App v2"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-key">Key</Label>
                <Input
                  id="project-key"
                  value={key}
                  disabled={Boolean(project)}
                  onChange={(e) => {
                    setKeyEdited(true);
                    setKey(
                      e.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, "")
                        .slice(0, 6),
                    );
                  }}
                  placeholder="MOB"
                  className="font-mono uppercase"
                  aria-describedby="key-help"
                />
              </div>
            </div>
            <p id="key-help" className="text-subtle -mt-2 text-xs">
              Task numbers start with the key, like {key || "MOB"}-1.
            </p>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <ColorPicker value={color} onChange={setColor} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-desc">Description</Label>
              <Textarea
                id="project-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this project for?"
                rows={2}
              />
            </div>
            {!project && (
              <fieldset>
                <legend className="text-fg-2 mb-2 text-[13px] font-medium">Start from</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {(Object.keys(TEMPLATES) as TemplateId[]).map((t) => (
                    <label
                      key={t}
                      className={cn(
                        "border-border hover:bg-elevated/50 rounded-card cursor-pointer border p-3 transition-colors",
                        template === t && "border-accent-border bg-accent-soft/40",
                      )}
                    >
                      <input
                        type="radio"
                        name="template"
                        value={t}
                        checked={template === t}
                        onChange={() => setTemplate(t)}
                        className="sr-only"
                      />
                      <span className="block text-sm font-medium">{TEMPLATES[t].name}</span>
                      <span className="text-muted mt-0.5 block text-xs leading-relaxed">
                        {TEMPLATES[t].description}
                        {TEMPLATES[t].tasks.length > 0 &&
                          ` ${TEMPLATES[t].tasks.length} starter tasks.`}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <FieldError>{error}</FieldError>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!name.trim()}>
              {project ? "Save changes" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewProjectProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Ctx.Provider value={() => setOpen(true)}>
      {children}
      {open && <ProjectDialog open={open} onOpenChange={setOpen} />}
    </Ctx.Provider>
  );
}

export function NewProjectButton({ label = "Create a project" }: { label?: string }) {
  const open = useNewProject();
  const { workspace } = useWorkspace();
  if (workspace.role === "guest") return null;
  return (
    <Button size="sm" onClick={open}>
      {label}
    </Button>
  );
}
