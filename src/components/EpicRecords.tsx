import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { loadEpicRecords } from "@/lib/external-import";

const categories = [
  ["all", "All"],
  ["vital-signs", "Vital signs"],
  ["laboratory", "Lab results"],
  ["conditions", "Conditions"],
  ["medications", "Medications"],
  ["encounters", "Encounters"],
] as const;

type Category = (typeof categories)[number][0];
type ClinicalRecord = {
  id: string;
  category: string;
  name: string;
  value: string | null;
  unit: string | null;
  date: string | null;
  status: string | null;
  source: string;
};
type EpicRecordPage = {
  records: ClinicalRecord[];
  total: number;
  counts: Record<string, number>;
  page: number;
  page_size: number;
  imported_at: number | null;
  digest_verified?: boolean;
  mapping_warning_count?: number;
  coverage_note?: string;
};

export function EpicRecords() {
  const [category, setCategory] = useState<Category>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<EpicRecordPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void loadEpicRecords(category, page)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((cause: unknown) => {
        if (active) {
          setData(null);
          setError(cause instanceof Error ? cause.message : "Could not load imported records.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [category, page, refresh]);

  const total = Object.values(data?.counts ?? {}).reduce((sum, count) => sum + count, 0);
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.page_size ?? 25)));
  return (
    <section
      aria-label="Imported Epic records"
      className="overflow-hidden rounded-xl border border-line bg-surface/70"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="font-semibold">Imported Epic records</h2>
          <p className="mt-1 text-sm text-mut">Your latest saved Epic Sandbox import</p>
          <Link to="/access" className="mt-2 inline-block text-sm text-aurora underline">
            Share a saved import
          </Link>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button
            disabled={loading}
            onClick={() => {
              setPage(1);
              setRefresh((n) => n + 1);
            }}
            className="rounded-md border border-line px-3 py-2 disabled:opacity-50"
          >
            Refresh Epic records
          </button>
          <Link to="/external-import" className="text-aurora underline">
            Import from Epic
          </Link>
        </div>
      </div>
      {data?.imported_at && (
        <div className="space-y-1 border-b border-line px-5 py-3 text-xs text-mut">
          <p>
            Epic Sandbox · Imported {new Date(data.imported_at * 1000).toLocaleString()} · {total}{" "}
            clinical records
          </p>
          {data.digest_verified && <p className="text-aurora">Saved records verified</p>}
          <p>{data.coverage_note}</p>
          {!!data.mapping_warning_count && (
            <p className="text-amber-300">
              Some fields need review; the original Epic records are preserved.
            </p>
          )}
        </div>
      )}
      <div
        role="group"
        aria-label="Filter Epic record category"
        className="flex flex-wrap gap-2 border-b border-line px-5 py-3"
      >
        {categories.map(([key, label]) => (
          <button
            key={key}
            disabled={loading}
            aria-pressed={category === key}
            onClick={() => {
              setCategory(key);
              setPage(1);
            }}
            className={`rounded-lg border px-3 py-2 text-sm disabled:opacity-50 ${category === key ? "border-aurora text-aurora" : "border-line text-mut"}`}
          >
            {label} ({key === "all" ? total : (data?.counts[key] ?? 0)})
          </button>
        ))}
      </div>
      {loading ? (
        <p role="status" className="p-6 text-sm text-mut">
          Loading imported records…
        </p>
      ) : error ? (
        <p role="alert" className="p-6 text-sm text-red-400">
          {error}
        </p>
      ) : !data?.records.length ? (
        <div className="space-y-2 p-6 text-sm">
          <p>
            {!data?.imported_at
              ? "No Epic records imported yet."
              : "No records returned in this category."}
          </p>
          <p className="text-mut">
            {!data?.imported_at
              ? "Connect to Epic and import a sandbox patient to see records here."
              : "Other categories may have records. Empty categories are recorded exactly as returned by Epic."}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 p-4 sm:hidden">
            {data.records.map((record) => (
              <article key={record.id} className="space-y-3 rounded-lg border border-line p-4">
                <div>
                  <h3 className="break-words font-medium">{record.name}</h3>
                  <p className="mt-1 text-xs text-mut">
                    {record.source} · {categories.find(([key]) => key === record.category)?.[1]}
                  </p>
                </div>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-mut">Value / details</dt>
                    <dd className="mt-1 break-words">
                      {record.value === null
                        ? "Not provided"
                        : `${record.value}${record.unit ? ` ${record.unit}` : ""}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-mut">Date from Epic</dt>
                    <dd className="mt-1 break-words">{record.date ?? "Not provided"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-mut">Status</dt>
                    <dd className="mt-1">{record.status ?? "Not provided"}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase text-mut">
                <tr>
                  <th className="px-5 py-3 font-medium">Record</th>
                  <th className="px-5 py-3 font-medium">Value / details</th>
                  <th className="px-5 py-3 font-medium">Date from Epic</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/50">
                {data.records.map((record) => (
                  <tr key={record.id}>
                    <td className="px-5 py-4">
                      <p className="font-medium">{record.name}</p>
                      <p className="mt-1 text-xs text-mut">
                        {record.source} · {categories.find(([key]) => key === record.category)?.[1]}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      {record.value === null
                        ? "Not provided"
                        : `${record.value}${record.unit ? ` ${record.unit}` : ""}`}
                    </td>
                    <td className="px-5 py-4 text-xs text-mut">{record.date ?? "Not provided"}</td>
                    <td className="px-5 py-4 text-mut">{record.status ?? "Not provided"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm">
            <button
              disabled={page <= 1}
              onClick={() => setPage((n) => n - 1)}
              className="rounded border border-line px-3 py-2 disabled:opacity-40"
            >
              Previous Epic page
            </button>
            <span role="status">
              Page {page} of {pages} · {data.total} records
            </span>
            <button
              disabled={page >= pages}
              onClick={() => setPage((n) => n + 1)}
              className="rounded border border-line px-3 py-2 disabled:opacity-40"
            >
              Next Epic page
            </button>
          </div>
        </>
      )}
    </section>
  );
}
