"use client";

import { FileText, ImageIcon, Paperclip, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addAttachment, deleteAttachment } from "@/lib/project/attachment-actions";
import type { TaskDetail } from "@/lib/project/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useProject } from "./store";

const MAX = 25 * 1024 * 1024;

const size = (b: number) =>
  b < 1024
    ? `${b} B`
    : b < 1024 ** 2
      ? `${Math.round(b / 1024)} KB`
      : `${(b / 1024 ** 2).toFixed(1)} MB`;
const isImage = (m: string) => m.startsWith("image/");

function Thumb({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    createClient()
      .storage.from("attachments")
      .createSignedUrl(path, 600)
      .then(
        (res: { data: { signedUrl: string } | null }) =>
          live && setUrl(res.data?.signedUrl ?? null),
      );
    return () => {
      live = false;
    };
  }, [path]);
  if (!url) return <ImageIcon className="text-subtle size-5" aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived Storage URL
  return <img src={url} alt={alt} className="size-full object-cover" />;
}

export function AttachmentsSection({ task, reload }: { task: TaskDetail; reload: () => void }) {
  const { canEdit } = useProject();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [pending, start] = useTransition();

  const upload = async (files: FileList | File[]) => {
    const list = [...files];
    const tooBig = list.filter((f) => f.size > MAX);
    if (tooBig.length) toast.error(`${tooBig.map((f) => f.name).join(", ")} is over 25 MB.`);
    const ok = list.filter((f) => f.size <= MAX);
    if (!ok.length) return;
    setUploading((n) => n + ok.length);
    const supabase = createClient();
    await Promise.all(
      ok.map(async (file) => {
        const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
        const path = `${task.id}/${crypto.randomUUID()}-${safe}`;
        const { error } = await supabase.storage
          .from("attachments")
          .upload(path, file, { contentType: file.type || undefined });
        if (error) {
          toast.error(`Couldn't upload ${file.name}.`);
        } else {
          const res = await addAttachment({
            taskId: task.id,
            path,
            fileName: file.name,
            sizeBytes: file.size,
            mimeType: file.type,
          });
          if (!res.ok) toast.error(res.error);
        }
        setUploading((n) => n - 1);
      }),
    );
    reload();
  };

  const download = async (path: string, name: string) => {
    const { data, error } = await createClient()
      .storage.from("attachments")
      .createSignedUrl(path, 60, { download: name });
    if (error || !data) return void toast.error("Couldn't open the file.");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  if (!canEdit && task.attachments.length === 0) return null;

  return (
    <section
      className="mt-6"
      onDragOver={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
      }}
    >
      <h3 className="text-subtle mb-2 flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
        Attachments{" "}
        {task.attachments.length > 0 && (
          <span className="normal-case">{task.attachments.length}</span>
        )}
      </h3>
      {task.attachments.length > 0 && (
        <ul className="mb-2 grid gap-2 sm:grid-cols-2">
          {task.attachments.map((a) => (
            <li
              key={a.id}
              className="group border-border bg-card hover:bg-elevated/40 rounded-control flex items-center gap-3 border p-2"
            >
              <button
                type="button"
                onClick={() => download(a.path, a.fileName)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <span className="bg-surface flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md">
                  {isImage(a.mimeType) ? (
                    <Thumb path={a.path} alt={a.fileName} />
                  ) : (
                    <FileText className="text-muted size-5" aria-hidden />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">{a.fileName}</span>
                  <span className="text-subtle block text-xs">
                    {size(a.sizeBytes)}
                    {a.uploader ? ` · ${a.uploader.name.split(" ")[0]}` : ""}
                  </span>
                </span>
              </button>
              {canEdit && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await deleteAttachment({ id: a.id });
                      if (!res.ok) toast.error(res.error);
                      reload();
                    })
                  }
                  className="text-subtle hover:text-danger-text rounded p-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Delete ${a.fileName}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div
          className={cn(
            "border-border text-muted rounded-control flex items-center justify-center gap-2 border border-dashed px-3 py-3 text-[13px] transition-colors",
            over && "border-accent bg-accent-soft/40 text-fg",
          )}
        >
          {uploading > 0 ? (
            <span>
              Uploading {uploading} {uploading === 1 ? "file" : "files"}…
            </span>
          ) : (
            <>
              <Upload className="size-4" aria-hidden />
              <span>Drop files here or</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => input.current?.click()}
              >
                <Paperclip /> Browse
              </Button>
            </>
          )}
          <input
            ref={input}
            type="file"
            multiple
            hidden
            onChange={(e) => e.target.files && upload(e.target.files)}
          />
        </div>
      )}
    </section>
  );
}
