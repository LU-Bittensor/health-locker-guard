import { RecordTagPicker } from "@/components/RecordTagPicker";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { DocumentViewer, UploadDocumentDialog } from "@/components/DocumentDialogs";
import { fetchRole } from "@/lib/vault-data";
import { VaultLayout } from "@/components/VaultLayout";
import { useDemoAccount } from "@/lib/demo-account";
import { supabase } from "@/integrations/supabase/client";
import { filterRecords, recordPage, type RecordFilters } from "@/lib/record-filters";
import { recordSource, type RecordSource } from "@/lib/record-source";
import {
  fetchRecordMetadata,
  grantRequest,
  localGrantDemo,
  type AccessGrant,
  type GrantRecord,
  type GrantUser,
} from "@/lib/grant-api";
import {
  listSharedGrantsForVault,
  registryConfigured,
  vaultEvmAddress,
} from "@/lib/registry-wallet";

type VisibleRecord = GrantRecord & { ownerId: string; ownerName: string; owned: boolean };

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function Vault({ ownerId, sharedOnly = false }: { ownerId?: string; sharedOnly?: boolean }) {
  const { demoUser } = useDemoAccount();
  const [account, setAccount] = useState<string | null>(null);
  const [checking, setChecking] = useState(!localGrantDemo);
  useEffect(() => {
    if (localGrantDemo) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccount(session?.user.id ?? null);
      setChecking(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  return (
    <VaultLayout>
      {checking ? (
        <p role="status">Checking your account…</p>
      ) : !localGrantDemo && !account ? (
        <Link to="/signin" className="text-aurora underline">
          Sign in to view your records
        </Link>
      ) : (
        <Records
          key={`${account ?? demoUser}:${ownerId || "all"}:${sharedOnly}`}
          demoUser={demoUser}
          ownerId={ownerId}
          sharedOnly={sharedOnly}
        />
      )}
    </VaultLayout>
  );
}

function Records({
  demoUser,
  ownerId,
  sharedOnly,
}: {
  demoUser: string;
  ownerId: string | undefined;
  sharedOnly: boolean;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewing, setViewing] = useState<VisibleRecord | null>(null);
  const [canUpload, setCanUpload] = useState(false);
  const [records, setRecords] = useState<VisibleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sharedHint, setSharedHint] = useState("");
  const [uploadsConfigured, setUploadsConfigured] = useState(true);
  const [filter, setFilter] = useState<"all" | "owned" | "shared">(sharedOnly ? "shared" : "all");
  const [source, setSource] = useState<"all" | RecordSource>("all");
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [kind, setKind] = useState("all");
  const [sort, setSort] = useState<RecordFilters["sort"]>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setSharedHint("");
    async function load() {
      const account = await grantRequest<GrantUser>("/enroll", demoUser, { method: "POST" });
      const [owned, grants, role, health] = await Promise.all([
        grantRequest<GrantRecord[]>("/records", demoUser),
        grantRequest<AccessGrant[]>("/grants", demoUser),
        localGrantDemo
          ? Promise.resolve(demoUser === "patient" ? "patient" : "provider")
          : fetchRole(),
        grantRequest<{ chain: boolean; document_uploads_configured?: boolean }>(
          "/health",
          demoUser,
        ),
      ]);
      const visible = new Map<string, VisibleRecord>();
      if (!sharedOnly)
        for (const record of owned) {
          if (!ownerId || account.id === ownerId)
            visible.set(`${account.id}:${record.id}`, {
              ...record,
              ownerId: account.id,
              ownerName: account.name,
              owned: true,
            });
        }
      for (const grant of grants) {
        if (
          grant.recipient_id !== account.id ||
          grant.status !== "active" ||
          (ownerId && grant.owner_id !== ownerId)
        )
          continue;
        for (const id of grant.record_ids)
          visible.set(`${grant.owner_id}:${id}`, {
            id,
            name: grant.record_name,
            kind: grant.scope,
            ...grant.document,
            ownerId: grant.owner_id,
            ownerName: grant.owner_name,
            owned: false,
          });
      }

      // Fold AccessGrantSet discoveries into the same Shared filter (no separate panel).
      if (health.chain && registryConfigured()) {
        if (!vaultEvmAddress()) {
          if (!cancelled)
            setSharedHint("Unlock your vault to discover on-chain shares for your address.");
        } else {
          try {
            const onChain = await listSharedGrantsForVault();
            for (const item of onChain) {
              const recordId = item.recordId || item.resourceId;
              const already = [...visible.values()].some(
                (row) => !row.owned && (row.id === recordId || row.id === item.recordId),
              );
              if (already) continue;
              if (ownerId && item.owner.toLowerCase() !== ownerId.toLowerCase()) continue;
              let meta: GrantRecord | null = null;
              if (item.recordId) {
                try {
                  meta = await fetchRecordMetadata(item.recordId, demoUser);
                } catch {
                  meta = null;
                }
              }
              const sharedRow: VisibleRecord = {
                id: recordId,
                name:
                  meta?.name ||
                  (item.recordId ? `Record ${item.recordId}` : item.dataCid || "Shared resource"),
                kind: meta?.kind || "On-chain share",
                has_document: meta?.has_document ?? Boolean(item.recordId),
                ownerId: meta?.owner_id || item.owner,
                ownerName: meta?.owner_id ? "Shared owner" : shortAddr(item.owner),
                owned: false,
              };
              if (meta?.tags) sharedRow.tags = meta.tags;
              if (meta?.mime_type != null) sharedRow.mime_type = meta.mime_type;
              if (meta?.size != null) sharedRow.size = meta.size;
              if (meta?.created_at) sharedRow.created_at = meta.created_at;
              visible.set(`${item.owner.toLowerCase()}:${recordId}`, sharedRow);
            }
          } catch (cause) {
            if (!cancelled)
              setSharedHint(
                cause instanceof Error ? cause.message : "Could not load on-chain shares.",
              );
          }
        }
      }

      if (!cancelled) {
        setRecords([...visible.values()]);
        setCanUpload(role === "patient" && health.document_uploads_configured !== false);
        setUploadsConfigured(health.document_uploads_configured !== false);
      }
    }
    void load()
      .catch((cause: unknown) => {
        if (!cancelled) {
          setRecords([]);
          setError(cause instanceof Error ? cause.message : "Could not load records.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [demoUser, ownerId, sharedOnly, refresh]);

  const ownedCount = records.filter((record) => record.owned).length;
  const sharedCount = records.length - ownedCount;
  const filteredRecords = filterRecords(records, {
    ownership: filter,
    source,
    kind,
    query,
    sort,
    categories,
  });
  const paged = recordPage(filteredRecords, page, pageSize);
  const kinds = [...new Set(records.map((record) => record.kind))].sort();
  const resetFilters = () => {
    setFilter(sharedOnly ? "shared" : "all");
    setSource("all");
    setKind("all");
    setCategories([]);
    setQuery("");
    setSort("newest");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-aurora">
            {localGrantDemo ? "Access testing" : "Your vault"}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {sharedOnly || ownerId ? "Shared records" : "Records"}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-mut">
            {localGrantDemo
              ? "The demo records used for your access tests. Shared records appear while their grants are active."
              : "Your Epic imports, MediLink documents, and shared records in one place."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!localGrantDemo && !sharedOnly && !ownerId && (
            <Link
              to="/external-import"
              className="rounded-lg border border-line px-4 py-2.5 text-sm"
            >
              Import from Epic
            </Link>
          )}
          {canUpload && !sharedOnly && !ownerId && (
            <button
              onClick={() => setUploadOpen(true)}
              className="rounded-lg border border-aurora px-4 py-2.5 text-sm font-semibold text-aurora"
            >
              Upload document
            </button>
          )}
          <Link
            to="/access"
            className="rounded-lg gradient-aurora px-4 py-2.5 text-sm font-semibold text-ink"
          >
            Manage access
          </Link>
        </div>
      </div>
      <section
        aria-label="All saved records"
        className="overflow-hidden rounded-xl border border-line/70 bg-surface/70"
      >
        <h2 className="border-b border-line px-5 py-4 font-semibold">
          {sharedOnly || ownerId ? "Shared records" : "All saved records"}
        </h2>
        {!uploadsConfigured && (
          <p className="border-b border-line px-5 py-3 text-sm text-mut">
            Document storage is not configured here. Existing legacy Epic imports may still be
            available. New encrypted uploads and imports require document storage.
          </p>
        )}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <span className="text-sm text-mut" role="status">
            {loading
              ? "Loading records…"
              : `${filteredRecords.length} of ${records.length} records`}
          </span>
          <button
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
            className="rounded-md border border-line px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Refresh records
          </button>
        </div>
        {!sharedOnly && (
          <div
            role="group"
            aria-label="Filter records by ownership"
            className="flex flex-wrap gap-2 border-b border-line px-5 py-3"
          >
            {(
              [
                ["all", "All", records.length],
                ["owned", "Owned", ownedCount],
                ["shared", "Shared", sharedCount],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                disabled={loading || !!error}
                onClick={() => {
                  setFilter(value);
                  setPage(1);
                }}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora disabled:opacity-50 ${
                  filter === value ? "border-current bg-surface2" : "border-line"
                } ${value === "owned" ? "text-sky-300" : value === "shared" ? "text-violet-300" : "text-tx"}`}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
          <label htmlFor="record-source" className="text-sm text-mut">
            Record source
          </label>
          <select
            id="record-source"
            value={source}
            disabled={loading || !!error}
            onChange={(event) => {
              setSource(event.target.value as "all" | RecordSource);
              setPage(1);
            }}
            className="rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-tx"
          >
            <option value="all">All sources</option>
            <option value="epic">Epic imports</option>
            <option value="medilink">MediLink records</option>
          </select>
          <p className="text-xs text-mut">
            Each Epic import is a saved snapshot. Open it to review its clinical records.
          </p>
        </div>
        <div className="grid gap-3 border-b border-line px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-xs text-mut">
            <span>Search records</span>
            <input
              type="search"
              value={query}
              disabled={loading || !!error}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Name, tag, record ID or sender"
              className="w-full rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-tx"
            />
          </label>
          <label className="space-y-1 text-xs text-mut">
            <span>Record type</span>
            <select
              aria-label="Record type"
              value={kind}
              disabled={loading || !!error}
              onChange={(event) => {
                setKind(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-tx"
            >
              <option value="all">All record types</option>
              {!kinds.includes(kind) && kind !== "all" && (
                <option value={kind}>{kind} (unavailable)</option>
              )}
              {kinds.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-mut">
            <span>Sort records</span>
            <select
              aria-label="Sort records"
              value={sort}
              disabled={loading || !!error}
              onChange={(event) => {
                setSort(event.target.value as RecordFilters["sort"]);
                setPage(1);
              }}
              className="w-full rounded-md border border-line bg-surface2 px-3 py-2 text-sm text-tx"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
          <button
            type="button"
            disabled={loading || !!error}
            onClick={resetFilters}
            className="self-end rounded-md border border-line px-3 py-2 text-sm disabled:opacity-50"
          >
            Clear filters
          </button>
        </div>
        <div className="border-b border-line px-5 py-3">
          <RecordTagPicker
            label="Filter by categories"
            value={categories}
            onChange={(value) => {
              setCategories(value);
              setPage(1);
            }}
            disabled={loading || !!error}
            existingTags={records.flatMap((record) => record.tags ?? [])}
          />
          <p className="mt-2 text-xs text-mut">
            Matches any selected category, combined with the other filters. Existing custom tags
            remain available.
          </p>
        </div>
        {error ? (
          <div role="alert" className="space-y-2 p-6 text-sm">
            <p className="text-red-400">
              {error.includes("SUPABASE_")
                ? "Document storage is not configured on this local server. Refresh after storage is configured to load your saved records."
                : error}
            </p>
            <p className="text-mut">
              Resolve the connection or account issue above, then refresh records.
            </p>
            {!localGrantDemo && (
              <Link to="/signin" className="text-aurora underline">
                Sign in
              </Link>
            )}
          </div>
        ) : !loading && filteredRecords.length === 0 ? (
          <div className="p-8 text-center">
            <h2 className="font-medium">
              {source !== "all" || query.trim() || kind !== "all" || categories.length > 0
                ? "No matching records"
                : filter === "owned"
                  ? "No owned records"
                  : filter === "shared"
                    ? "No shared records"
                    : "No records yet"}
            </h2>
            <p className="mt-2 text-sm text-mut">
              {source !== "all" || query.trim() || kind !== "all" || categories.length > 0
                ? "No records match your filters. Clear filters to see the available records."
                : filter === "owned"
                  ? "Records you own will appear here."
                  : filter === "shared"
                    ? sharedHint ||
                      "API grants and on-chain AccessGrantSet shares for your vault appear here."
                    : "Records you own or that have been shared with you will appear here."}
            </p>
            <Link to="/access" className="mt-4 inline-block text-sm text-aurora">
              Open access ledger →
            </Link>
          </div>
        ) : (
          !loading && (
            <div className="overflow-x-auto">
              {filter === "shared" && sharedHint && (
                <p role="status" className="border-b border-line px-5 py-3 text-xs text-aurora">
                  {sharedHint}
                </p>
              )}
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line/50 text-xs uppercase tracking-wide text-mut">
                  <tr>
                    <th className="px-5 py-3 font-medium">Record</th>
                    <th className="px-5 py-3 font-medium">Source</th>
                    <th className="px-5 py-3 font-medium">Access</th>
                    <th className="px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/50">
                  {paged.records.map((record) => (
                    <tr
                      key={`${record.ownerId}:${record.id}`}
                      className={record.owned ? "bg-sky-400/5" : "bg-violet-400/5"}
                    >
                      <td className="px-5 py-5">
                        {record.has_document ? (
                          <button
                            onClick={() => setViewing(record)}
                            className="text-left font-medium text-aurora underline underline-offset-4"
                          >
                            {record.name}
                          </button>
                        ) : (
                          <p className="font-medium">{record.name}</p>
                        )}
                        {record.tags && record.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {record.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full border border-line px-2 py-0.5 text-xs text-mut"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="mt-1 text-xs text-mut">{record.kind}</p>
                        <details className="mt-2 text-xs text-mut">
                          <summary>Record details</summary>
                          <p className="mt-1 break-all font-mono">{record.id}</p>
                          {record.created_at && (
                            <p>Saved: {new Date(record.created_at).toLocaleString()}</p>
                          )}
                        </details>
                      </td>
                      <td className="px-5 py-5">
                        <span className="rounded-full border border-line px-2.5 py-1 text-xs">
                          {recordSource(record) === "epic" ? "Epic import" : "MediLink"}
                        </span>
                        <p className="mt-2 text-xs text-mut">
                          {recordSource(record) === "epic"
                            ? "Saved clinical snapshot"
                            : "Saved record"}
                        </p>
                      </td>
                      <td className="px-5 py-5">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-1 text-xs font-medium ${record.owned ? "border-sky-300/30 bg-sky-400/10 text-sky-300" : "border-violet-300/30 bg-violet-400/10 text-violet-300"}`}
                        >
                          {record.owned ? "Owned by you" : "Shared with you"}
                        </span>
                        {!record.owned && (
                          <p className="mt-1 text-xs text-mut">From {record.ownerName}</p>
                        )}
                      </td>
                      <td className="px-5 py-5">
                        <div className="flex flex-wrap gap-2">
                          {record.has_document && (
                            <button
                              onClick={() => setViewing(record)}
                              className="rounded-md border border-line px-3 py-1.5 text-xs"
                              aria-label={`Open ${record.name}`}
                            >
                              Open
                            </button>
                          )}
                          <Link
                            to="/access"
                            search={record.owned ? { record: record.id } : {}}
                            aria-label={`${record.owned ? "Share" : "View access for"} ${record.name}`}
                            className="rounded-md border border-line px-3 py-1.5 text-xs text-aurora"
                          >
                            {record.owned ? "Share" : "View access"}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        {!error && !loading && filteredRecords.length > 0 && (
          <nav
            aria-label="Record pages"
            className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3 text-sm"
          >
            <label className="flex items-center gap-2 text-mut">
              Records per page
              <select
                aria-label="Records per page"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="rounded-md border border-line bg-surface2 px-2 py-1 text-tx"
              >
                {[10, 25, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <span role="status">
              Page {paged.page} of {paged.pages} · {filteredRecords.length} records
            </span>
            <div className="flex gap-2">
              <button
                disabled={paged.page <= 1}
                onClick={() => setPage(paged.page - 1)}
                className="rounded-md border border-line px-3 py-1.5 disabled:opacity-50"
              >
                Previous page
              </button>
              <button
                disabled={paged.page >= paged.pages}
                onClick={() => setPage(paged.page + 1)}
                className="rounded-md border border-line px-3 py-1.5 disabled:opacity-50"
              >
                Next page
              </button>
            </div>
          </nav>
        )}
      </section>
      {uploadOpen && (
        <UploadDocumentDialog
          open
          onOpenChange={setUploadOpen}
          demoUser={demoUser}
          onUploaded={() => setRefresh((value) => value + 1)}
        />
      )}
      {viewing && (
        <DocumentViewer
          key={viewing.id}
          record={viewing}
          demoUser={demoUser}
          onClose={() => setViewing(null)}
        />
      )}
      <p className="text-xs text-mut">
        Open a record to preview its contents. Epic snapshots include their saved clinical details.
        Manage sharing and revocation from the access ledger.
      </p>
    </div>
  );
}
