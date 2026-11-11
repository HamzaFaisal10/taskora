"use client";

import { FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { PriorityIcon } from "@/components/tasks/task-meta";
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
import { parseCsv } from "@/lib/csv";
import { importTasks } from "@/lib/project/actions";
import { mapImport, type ImportResult } from "@/lib/project/import";
import { cn } from "@/lib/utils";
import { useProject } from "./store";

const FIELD_LABEL: Record<string, string> = {
  title: "Title",
  description: "Description",
  status: "Status",
  priority: "Priority",
  assignee: "Assignee",
  due: "Due date",
  estimate: "Estimate",
  labels: "Labels",
};

/** Import tasks from a CSV file: pick a file, check the preview, then import. */
export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { project, statuses, people, labels, refresh } = useProject();
  const [file, setFile] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const read = async (f: File | undefined) => {
    if (!f) return;
    setError(undefined);
    if (f.size > 5 * 1024 * 1024)
      return setError("That file is over 5 MB. Split it into smaller files.");
    if (!/\.(csv|txt)$/i.test(f.name) && !/csv|text/.test(f.type))
      return setError("Choose a .csv file. In Excel or Google Sheets, use File → Download → CSV.");
    const text = await f.text();
    setFile(f.name);
    setResult(mapImport(parseCsv(text), { statuses, people, labels }));
  };

  const run = () =>
    start(async () => {
      if (!result?.tasks.length) return;
      const res = await importTasks({ projectId: project.id, tasks: result.tasks });
      if (!res.ok) return void toast.error(res.error);
      toast.success(
        `Imported ${res.data} ${res.data === 1 ? "task" : "tasks"} into ${project.name}`,
      );
      refresh();
      onOpenChange(false);
    });

  const statusName = (id: string | null) =>
    statuses.find((s) => s.id === id)?.name ?? statuses[0]?.name ?? "First column";
  const personName = (id: string | null) => people.find((p) => p.id === id)?.name ?? "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Import tasks from CSV</DialogTitle>
          <DialogDescription>
            One task per row with a header row. Columns Taskora understands: Title, Description,
            Status, Priority, Assignee (name or email), Due date, Estimate and Labels. Exports from
            Taskora, Trello, Asana and Jira work.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void read(e.dataTransfer.files[0]);
            }}
            className={cn(
              "border-border rounded-card flex flex-col items-center gap-2 border border-dashed px-4 py-6 text-center",
              dragging && "border-accent bg-accent-soft/30",
            )}
          >
            <FileSpreadsheet className="text-subtle size-6" aria-hidden />
            <p className="text-sm">
              {file ? <span className="font-medium">{file}</span> : "Drop a CSV file here, or"}
            </p>
            <Button size="sm" variant="secondary" onClick={() => input.current?.click()}>
              <Upload /> {file ? "Choose another file" : "Choose file"}
            </Button>
            <input
              ref={input}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="CSV file"
              onChange={(e) => {
                void read(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          {error && <p className="text-danger-text text-sm">{error}</p>}

          {result && (
            <div className="space-y-3">
              {Object.keys(result.columns).length > 0 && (
                <p className="text-muted text-[13px]">
                  Using{" "}
                  {Object.entries(result.columns)
                    .map(([f, col]) =>
                      FIELD_LABEL[f] === col ? `“${col}”` : `“${col}” as ${FIELD_LABEL[f]}`,
                    )
                    .join(", ")}
                  .
                </p>
              )}
              {result.warnings.length > 0 && (
                <ul className="border-warning/40 bg-warning/5 rounded-control space-y-1 border px-3 py-2 text-[13px]">
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
              {result.tasks.length > 0 && (
                <div className="border-border rounded-card overflow-x-auto border">
                  <table className="w-full min-w-[520px] text-[13px]">
                    <caption className="sr-only">Preview of the first tasks</caption>
                    <thead>
                      <tr className="text-subtle border-border border-b text-left text-xs">
                        <th className="px-3 py-2 font-medium">Title</th>
                        <th className="py-2 font-medium">Status</th>
                        <th className="py-2 font-medium">Assignee</th>
                        <th className="px-3 py-2 text-right font-medium">Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.tasks.slice(0, 8).map((t, i) => (
                        <tr key={i} className="border-border-subtle border-b last:border-0">
                          <td className="max-w-64 px-3 py-2">
                            <span className="flex items-center gap-2">
                              <PriorityIcon priority={t.priority} />
                              <span className="truncate">{t.title}</span>
                            </span>
                          </td>
                          <td className="text-muted py-2">{statusName(t.statusId)}</td>
                          <td className="text-muted py-2">{personName(t.assigneeId)}</td>
                          <td className="text-muted px-3 py-2 text-right tabular-nums">
                            {t.dueDate ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.tasks.length > 8 && (
                    <p className="text-subtle border-border-subtle border-t px-3 py-2 text-xs">
                      and {result.tasks.length - 8} more
                    </p>
                  )}
                </div>
              )}
              {result.skipped > 0 && (
                <p className="text-subtle text-xs">
                  {result.skipped} {result.skipped === 1 ? "row" : "rows"} without a title will be
                  skipped.
                </p>
              )}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={run} loading={pending} disabled={!result?.tasks.length}>
            {result?.tasks.length
              ? `Import ${result.tasks.length} ${result.tasks.length === 1 ? "task" : "tasks"}`
              : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
