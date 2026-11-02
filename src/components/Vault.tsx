import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

import { AccessPanel } from "@/components/AccessPanel";
import { SharedWithYouPanel } from "@/components/SharedWithYouPanel";
import {
  listOwnedRecords,
  localGrantDemo,
  uploadOwnedRecord,
  type GrantRecord,
} from "@/lib/grant-api";
import { clearVaultSession } from "@/lib/vault-session";

import sealedFolder from "@/assets/sealed-folder.jpg";
import { supabase } from "@/integrations/supabase/client";

type RecordItem = {
  id: string;
  name: string;
  kind: string;
  date: string;
  source: string;
};

const recordTypes = ["Lab report", "Imaging", "Cardiology", "History", "Visit note"];

function formatRecordDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yy = String(d.getUTCFullYear()).slice(2);
  return `${mm}/${dd}/${yy}`;
}

function toRecordItem(row: GrantRecord): RecordItem {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind || "Document",
    date: formatRecordDate(row.created_at),
    source: row.has_document === false ? "Metadata only" : "You · uploaded",
  };
}

export function Vault({
  showLedger = true,
  roleLabel = "Patient",
  initials = "RM",
  patientName,
  backTo,
}: {
  showLedger?: boolean;
  roleLabel?: string;
  initials?: string;
  patientName?: string;
  backTo?: "/provider";
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [records, setRecords] = useState<RecordItem[]>([]);
  const [selected, setSelected] = useState("");
  const [section, setSection] = useState<"records" | "upload" | "permissions">("records");
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [recordsError, setRecordsError] = useState("");
  const [recordsVersion, setRecordsVersion] = useState(0);

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [kind, setKind] = useState<string>(recordTypes[0]!);
  const [tags, setTags] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const sections = showLedger
    ? (["records", "upload", "permissions"] as const)
    : (["records", "upload"] as const);

  const size = useMemo(() => (file ? (file.size / 1024 / 1024).toFixed(1) : "0.0"), [file]);

  const refreshRecords = useCallback(async () => {
    setLoadingRecords(true);
    setRecordsError("");
    try {
      const rows = await listOwnedRecords();
      const items = rows.map(toRecordItem);
      setRecords(items);
      setSelected((current) =>
        current && items.some((item) => item.id === current) ? current : (items[0]?.id ?? ""),
      );
    } catch (cause) {
      setRecords([]);
      setRecordsError(cause instanceof Error ? cause.message : "Could not load records.");
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    void refreshRecords();
  }, [refreshRecords, recordsVersion]);

  function pick(f: File | null | undefined) {
    if (f) setFile(f);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  }

  function onInput(e: ChangeEvent<HTMLInputElement>) {
    pick(e.target.files?.[0]);
  }

  async function seal() {
    if (!file) {
      setUploadError("Choose a PDF, PNG, JPEG, or text file to upload.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const created = await uploadOwnedRecord({ file, tags, kind });
      const item = toRecordItem(created);
      setRecords((prev) => [item, ...prev.filter((row) => row.id !== item.id)]);
      setSelected(item.id);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setSection("records");
      setRecordsVersion((n) => n + 1);
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSignOut() {
    if (localGrantDemo) return;
    clearVaultSession();
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/signin", replace: true });
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink font-sans text-tx antialiased">
      <div className="pointer-events-none fixed inset-0 aurora-field" />

      <div className="relative mx-auto max-w-[1440px]">
        <header className="sticky top-0 z-20 border-b border-line/70 bg-ink/70 backdrop-blur-md">
          <div className="flex h-14 items-center gap-6 px-6">
            <div className="flex items-center gap-2.5">
              <div className="grid size-6 place-items-center rounded-md gradient-aurora">
                <span className="size-2 rounded-full bg-ink/80" />
              </div>
              <span className="text-[15px] font-semibold tracking-tight">Medilink</span>
              <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-mut">
                {roleLabel}
              </span>
            </div>
            {backTo && (
              <Link
                to={backTo}
                className="rounded-md border border-line px-2.5 py-1.5 font-mono text-[11px] text-mut transition-colors hover:border-aurora/50 hover:text-tx"
              >
                ← All patients
              </Link>
            )}
            {patientName && (
              <span className="text-[13px] font-medium">
                <span className="text-mut">Viewing </span>
                {patientName}
              </span>
            )}

            <nav className="ml-4 flex items-center gap-1 text-[13px]">
              {sections.map((s) => (
                <button
                  key={s}
                  onClick={() => setSection(s)}
                  className={`rounded-md px-3 py-1.5 capitalize transition-colors ${
                    section === s ? "bg-surface2/70 font-medium text-tx" : "text-mut hover:text-tx"
                  }`}
                >
                  {s}
                </button>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-md border border-line px-3 py-1.5 font-mono text-[12px] text-mut md:flex">
                <span className="size-1.5 rounded-full bg-aurora animate-vault-pulse" />
                Vault sealed
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-md border border-line px-2.5 py-1.5 font-mono text-[11px] text-mut transition-colors hover:border-aurora/50 hover:text-tx"
              >
                Sign out
              </button>
              <div className="grid size-8 place-items-center rounded-full bg-linear-to-br from-aurora3 to-aurora2 text-[11px] font-semibold text-ink">
                {initials}
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-4 p-4">
          {/* Upload column */}
          <aside className="col-span-12 space-y-4 lg:col-span-4">
            <div className="relative aspect-16/10 overflow-hidden rounded-xl outline-1 -outline-offset-1 outline-tx/5">
              <img
                src={sealedFolder}
                alt="A sealed linen medical folder closed with a wax seal"
                width={1024}
                height={640}
                className="size-full object-cover"
              />
            </div>

            <div className="rounded-xl border border-line/70 bg-surface/70 p-4 backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mut">
                  Upload record
                </h2>
                <span className="font-mono text-[10px] text-mut">{size}MB</span>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`cursor-pointer rounded-lg border border-dashed px-4 py-6 text-center transition-colors ${
                  dragging ? "border-aurora bg-aurora/10" : "border-aurora/40 bg-aurora/[0.04]"
                }`}
              >
                <div className="mx-auto mb-2.5 grid size-9 place-items-center rounded-lg bg-linear-to-br from-aurora/25 to-aurora2/25">
                  <div className="size-3.5 rounded-sm bg-aurora" />
                </div>
                <p className="text-[13px] font-medium">{file ? file.name : "Drop files to seal"}</p>
                <p className="mt-0.5 text-[11px] text-mut">PDF · PNG · JPEG · text · max 10MB</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain"
                  className="hidden"
                  onChange={onInput}
                  aria-label="Choose a medical record file"
                />
              </div>

              <div className="mt-3.5 space-y-2 text-[12px]">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="kind" className="text-mut">
                    Record type
                  </label>
                  <select
                    id="kind"
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                    disabled={uploading}
                    className="rounded border border-line bg-surface2/60 px-2 py-1 font-mono text-[12px] text-tx outline-none focus:border-aurora/60"
                  >
                    {recordTypes.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="tags" className="text-mut">
                    Tags
                  </label>
                  <input
                    id="tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    disabled={uploading}
                    placeholder="cardio, fasting"
                    className="w-40 rounded border border-line bg-surface2/60 px-2 py-1 text-right font-mono text-[11px] text-tx outline-none focus:border-aurora/60"
                  />
                </div>
              </div>

              {uploadError && (
                <p role="alert" className="mt-3 text-[12px] text-aurora">
                  {uploadError}
                </p>
              )}

              <button
                type="button"
                onClick={() => void seal()}
                disabled={uploading || !file}
                className="mt-4 w-full rounded-lg gradient-aurora py-2.5 text-[13px] font-semibold text-ink transition-transform active:scale-[0.99] disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "Seal & add record"}
              </button>
              <p className="mt-2 text-[11px] text-mut">
                Uploads go to the grant API → Supabase <code className="font-mono">records</code>{" "}
                (file bytes). Access ledger shares those same rows.
              </p>
            </div>
          </aside>

          {/* Records */}
          <main className={showLedger ? "col-span-12 lg:col-span-5" : "col-span-12 lg:col-span-8"}>
            <div className="overflow-hidden rounded-xl border border-line/70 bg-surface/60 backdrop-blur-xl">
              <div className="flex h-11 items-center justify-between border-b border-line/70 px-4">
                <h1 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mut">
                  Records
                </h1>
                <span className="font-mono text-[11px] text-mut">
                  {loadingRecords ? "…" : `${records.length} total`}
                </span>
              </div>
              <div className="grid grid-cols-[1.6fr_0.9fr_1fr] gap-2 border-b border-line/50 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-mut">
                <span>Type</span>
                <span>Date</span>
                <span>Source</span>
              </div>
              <div className="divide-y divide-line/50 text-[13px]">
                {loadingRecords && (
                  <p className="px-4 py-6 text-[12px] text-mut">Loading records from the API…</p>
                )}
                {!loadingRecords && recordsError && (
                  <p role="alert" className="px-4 py-6 text-[12px] text-aurora">
                    {recordsError}
                  </p>
                )}
                {!loadingRecords && !recordsError && records.length === 0 && (
                  <p className="px-4 py-6 text-[12px] text-mut">
                    No uploaded records yet. Use Upload to seal a file into your account.
                  </p>
                )}
                {!loadingRecords &&
                  records.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelected(r.id)}
                      className={`grid w-full grid-cols-[1.6fr_0.9fr_1fr] items-center gap-2 px-4 py-3 text-left transition-colors ${
                        selected === r.id ? "bg-aurora/[0.05]" : "hover:bg-surface2/40"
                      }`}
                    >
                      <div>
                        <div className={`font-medium ${selected === r.id ? "text-aurora" : ""}`}>
                          {r.name}
                        </div>
                        <div className="text-[11px] text-mut">{r.kind}</div>
                      </div>
                      <div className="font-mono text-[12px] text-mut">{r.date}</div>
                      <div className="text-[12px] text-mut">{r.source}</div>
                    </button>
                  ))}
              </div>
            </div>

            <SharedWithYouPanel refreshKey={recordsVersion} />
          </main>

          {showLedger && (
            <aside className="col-span-12 lg:col-span-3">
              {/* Remount when uploads change so the ledger reloads API records. */}
              <AccessPanel key={recordsVersion} />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
