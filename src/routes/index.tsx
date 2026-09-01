import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";

import sealedFolder from "@/assets/sealed-folder.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SableVault — Records, Uploads & Access" },
      {
        name: "description",
        content:
          "Browse medical records, seal new uploads, and grant or revoke clinician access from a single ledger.",
      },
      { property: "og:title", content: "SableVault — Records, Uploads & Access" },
      {
        property: "og:description",
        content:
          "Browse medical records, seal new uploads, and grant or revoke clinician access from a single ledger.",
      },
    ],
  }),
  component: Vault,
});

type Record = {
  id: string;
  name: string;
  kind: string;
  date: string;
  source: string;
};

type Grant = {
  id: string;
  who: string;
  scope: string;
  expires: string;
  active: boolean;
  highlight?: boolean;
};

const initialRecords: Record[] = [
  { id: "r1", name: "Lipid panel", kind: "Lab report", date: "01/14/25", source: "Quest" },
  { id: "r2", name: "Chest X-ray", kind: "Imaging", date: "12/02/24", source: "Mercy Hospital" },
  { id: "r3", name: "A1C trend", kind: "Lab report", date: "10/21/24", source: "Quest" },
  { id: "r4", name: "ECG — resting", kind: "Cardiology", date: "09/08/24", source: "Dr. Alvarez" },
  { id: "r5", name: "Immunization log", kind: "History", date: "06/30/24", source: "Dr. Osei" },
  { id: "r6", name: "MRI — lumbar", kind: "Imaging", date: "04/11/24", source: "Mercy Hospital" },
];

const initialGrants: Grant[] = [
  { id: "g1", who: "Dr. Alvarez", scope: "Cardiology", expires: "Expires 03/14/25", active: true },
  {
    id: "g2",
    who: "Mercy Hospital",
    scope: "Imaging",
    expires: "Expires 07/01/25",
    active: true,
  },
  {
    id: "g3",
    who: "Family access",
    scope: "All records",
    expires: "No expiry",
    active: true,
    highlight: true,
  },
];

const recordTypes = ["Lab report", "Imaging", "Cardiology", "History", "Visit note"];

function Vault() {
  const [records, setRecords] = useState<Record[]>(initialRecords);
  const [grants, setGrants] = useState<Grant[]>(initialGrants);
  const [selected, setSelected] = useState("r2");
  const [section, setSection] = useState<"records" | "upload" | "permissions">("records");

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [kind, setKind] = useState(recordTypes[0]);
  const [date, setDate] = useState("2025-01-14");
  const [tags, setTags] = useState("cardio, fasting");
  const inputRef = useRef<HTMLInputElement>(null);

  const [newWho, setNewWho] = useState("");
  const [newScope, setNewScope] = useState("All records");

  const size = useMemo(
    () => (file ? (file.size / 1024 / 1024).toFixed(1) : "0.0"),
    [file],
  );

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

  function seal() {
    const id = `r${Date.now()}`;
    const [y, m, d] = date.split("-");
    setRecords((prev) => [
      {
        id,
        name: file ? file.name.replace(/\.[^.]+$/, "") : "Untitled record",
        kind,
        date: m && d && y ? `${m}/${d}/${y.slice(2)}` : date,
        source: "You · uploaded",
      },
      ...prev,
    ]);
    setSelected(id);
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function grantAccess() {
    if (!newWho.trim()) return;
    setGrants((prev) => [
      ...prev,
      {
        id: `g${Date.now()}`,
        who: newWho.trim(),
        scope: newScope,
        expires: "No expiry",
        active: true,
      },
    ]);
    setNewWho("");
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
              <span className="text-[15px] font-semibold tracking-tight">SableVault</span>
              <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-mut">
                Medical
              </span>
            </div>
            <nav className="ml-4 flex items-center gap-1 text-[13px]">
              {(["records", "upload", "permissions"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSection(s)}
                  className={`rounded-md px-3 py-1.5 capitalize transition-colors ${
                    section === s
                      ? "bg-surface2/70 font-medium text-tx"
                      : "text-mut hover:text-tx"
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
              <div className="grid size-8 place-items-center rounded-full bg-linear-to-br from-aurora3 to-aurora2 text-[11px] font-semibold text-ink">
                RM
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
                  dragging
                    ? "border-aurora bg-aurora/10"
                    : "border-aurora/40 bg-aurora/[0.04]"
                }`}
              >
                <div className="mx-auto mb-2.5 grid size-9 place-items-center rounded-lg bg-linear-to-br from-aurora/25 to-aurora2/25">
                  <div className="size-3.5 rounded-sm bg-aurora" />
                </div>
                <p className="text-[13px] font-medium">
                  {file ? file.name : "Drop files to seal"}
                </p>
                <p className="mt-0.5 text-[11px] text-mut">PDF · DICOM · JPG · max 50MB</p>
                <input
                  ref={inputRef}
                  type="file"
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
                    className="rounded border border-line bg-surface2/60 px-2 py-1 font-mono text-[12px] text-tx outline-none focus:border-aurora/60"
                  >
                    {recordTypes.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="date" className="text-mut">
                    Date
                  </label>
                  <input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="rounded border border-line bg-surface2/60 px-2 py-1 font-mono text-[12px] text-tx outline-none focus:border-aurora/60"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="tags" className="text-mut">
                    Tags
                  </label>
                  <input
                    id="tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-40 rounded border border-line bg-surface2/60 px-2 py-1 text-right font-mono text-[11px] text-tx outline-none focus:border-aurora/60"
                  />
                </div>
              </div>

              <button
                onClick={seal}
                className="mt-4 w-full rounded-lg gradient-aurora py-2.5 text-[13px] font-semibold text-ink transition-transform active:scale-[0.99]"
              >
                Seal &amp; add record
              </button>
            </div>
          </aside>

          {/* Records */}
          <main className="col-span-12 lg:col-span-5">
            <div className="overflow-hidden rounded-xl border border-line/70 bg-surface/60 backdrop-blur-xl">
              <div className="flex h-11 items-center justify-between border-b border-line/70 px-4">
                <h1 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mut">
                  Records
                </h1>
                <span className="font-mono text-[11px] text-mut">{records.length} total</span>
              </div>
              <div className="grid grid-cols-[1.6fr_0.9fr_1fr] gap-2 border-b border-line/50 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-mut">
                <span>Type</span>
                <span>Date</span>
                <span>Source</span>
              </div>
              <div className="divide-y divide-line/50 text-[13px]">
                {records.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r.id)}
                    className={`grid w-full grid-cols-[1.6fr_0.9fr_1fr] items-center gap-2 px-4 py-3 text-left transition-colors ${
                      selected === r.id ? "bg-aurora/[0.05]" : "hover:bg-surface2/40"
                    }`}
                  >
                    <div>
                      <div
                        className={`font-medium ${selected === r.id ? "text-aurora" : ""}`}
                      >
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
          </main>

          {/* Access ledger */}
          <aside className="col-span-12 lg:col-span-3">
            <div className="overflow-hidden rounded-xl border border-line/70 bg-surface/60 backdrop-blur-xl">
              <div className="flex h-11 items-center border-b border-line/70 px-4">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mut">
                  Access ledger
                </h2>
              </div>
              <div className="space-y-2 p-3 text-[13px]">
                {grants.map((g) => (
                  <div
                    key={g.id}
                    className={`animate-rise rounded-lg border p-3 ${
                      g.highlight
                        ? "border-aurora/40 bg-aurora/[0.06]"
                        : "border-line/60 bg-surface2/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-medium ${g.highlight ? "text-aurora" : ""} ${
                          g.active ? "" : "text-mut line-through"
                        }`}
                      >
                        {g.who}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-mut">
                        {g.scope}
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="text-[11px] text-mut">{g.expires}</span>
                      {g.highlight ? (
                        <button
                          role="switch"
                          aria-checked={g.active}
                          aria-label={`Toggle ${g.who}`}
                          onClick={() =>
                            setGrants((prev) =>
                              prev.map((x) =>
                                x.id === g.id ? { ...x, active: !x.active } : x,
                              ),
                            )
                          }
                          className={`relative h-5 w-9 rounded-full transition-colors ${
                            g.active ? "bg-aurora" : "bg-line"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 size-4 rounded-full bg-ink transition-all ${
                              g.active ? "right-0.5" : "left-0.5"
                            }`}
                          />
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            setGrants((prev) => prev.filter((x) => x.id !== g.id))
                          }
                          className="rounded-md border border-line px-2.5 py-1 font-mono text-[11px] text-mut transition-colors hover:border-aurora/50 hover:text-tx"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2 border-t border-line/70 p-3">
                <label
                  htmlFor="who"
                  className="block font-mono text-[10px] uppercase tracking-[0.12em] text-mut"
                >
                  Grant access
                </label>
                <input
                  id="who"
                  value={newWho}
                  onChange={(e) => setNewWho(e.target.value)}
                  placeholder="Clinician or organization"
                  className="w-full rounded-md border border-line bg-surface2/60 px-2.5 py-2 text-[12px] text-tx outline-none placeholder:text-mut/70 focus:border-aurora/60"
                />
                <select
                  value={newScope}
                  onChange={(e) => setNewScope(e.target.value)}
                  aria-label="Access scope"
                  className="w-full rounded-md border border-line bg-surface2/60 px-2.5 py-2 font-mono text-[12px] text-tx outline-none focus:border-aurora/60"
                >
                  <option>All records</option>
                  {recordTypes.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <button
                  onClick={grantAccess}
                  className="w-full rounded-md border border-aurora/40 bg-aurora/[0.06] py-2 text-[12px] font-medium text-aurora transition-colors hover:bg-aurora/10"
                >
                  Grant
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
