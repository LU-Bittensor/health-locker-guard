import { epicPreview } from "@/lib/epic-preview";
import { useEffect, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { uploadDocument, viewDocument, type GrantRecord } from "@/lib/grant-api";

const fieldClass = "w-full rounded-md border border-line bg-surface2 p-2 text-sm";

export function UploadDocumentDialog({
  open,
  onOpenChange,
  demoUser,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  demoUser: string;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || busy) return;
    if (!file.size || file.size > 10 * 1024 * 1024) {
      setError("Choose a non-empty document up to 10 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await uploadDocument(file, tags, demoUser);
      onUploaded();
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent className="border-line bg-ink text-tx">
        <DialogTitle>Upload document</DialogTitle>
        <DialogDescription>
          Choose a PDF, PNG, JPEG, or text file up to 10 MB. Unlock your vault first. New documents
          are encrypted in your browser; only you can view them until you share access.
        </DialogDescription>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="document-file">Document</label>
            <input
              id="document-file"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.txt"
              required
              disabled={busy}
              className={fieldClass}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="document-tags">Tags</label>
            <input
              id="document-tags"
              value={tags}
              maxLength={1000}
              disabled={busy}
              placeholder="Lab results, annual checkup"
              className={fieldClass}
              onChange={(event) => setTags(event.target.value)}
              aria-describedby="tags-help"
            />
            <p id="tags-help" className="text-xs text-mut">
              Separate tags with commas. Up to 20 tags, 50 characters each.
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !file}
            className="rounded-lg gradient-aurora px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
          >
            {busy ? "Uploading…" : "Upload document"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentViewer({
  record,
  demoUser,
  onClose,
}: {
  record: GrantRecord;
  demoUser: string;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<{
    url: string;
    type: string;
    text?: string | undefined;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setPreview(null);
    setError("");
    const controller = new AbortController();
    let url: string | undefined;
    async function load() {
      const blob = await viewDocument(record.id, demoUser, controller.signal);
      const type = blob.type.split(";")[0] ?? "";
      if (!["application/pdf", "image/png", "image/jpeg", "text/plain"].includes(type)) {
        throw new Error("This document type cannot be previewed.");
      }
      const text = type === "text/plain" ? await blob.text() : undefined;
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob);
      setPreview({
        url,
        type,
        text: text && record.kind === "Epic import" ? epicPreview(text) : text,
      });
    }
    void load().catch((cause: unknown) => {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : "Could not open document.");
    });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [record.id, record.kind, demoUser]);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-5xl border-line bg-ink text-tx">
        <DialogTitle className="break-all pr-6">{record.name}</DialogTitle>
        <DialogDescription>Document preview</DialogDescription>
        {error ? (
          <p role="alert" className="text-red-400">
            {error}
          </p>
        ) : !preview ? (
          <p role="status">Checking access and loading document…</p>
        ) : preview.type === "text/plain" ? (
          <pre className="h-[65vh] overflow-auto whitespace-pre-wrap break-words rounded bg-white p-4 text-sm text-black">
            {preview.text}
          </pre>
        ) : preview.type.startsWith("image/") ? (
          <img src={preview.url} alt={record.name} className="h-[65vh] w-full object-contain" />
        ) : (
          <iframe
            title={record.name}
            src={preview.url}
            className="h-[65vh] w-full rounded bg-white"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
