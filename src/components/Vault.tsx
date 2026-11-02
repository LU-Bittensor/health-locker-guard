import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { DocumentViewer, UploadDocumentDialog } from "@/components/DocumentDialogs";
import { SharedWithYouPanel } from "@/components/SharedWithYouPanel";
import { fetchRole } from "@/lib/vault-data";
import { VaultLayout } from "@/components/VaultLayout";
import { useDemoAccount } from "@/lib/demo-account";
import {
  grantRequest,
  localGrantDemo,
  type AccessGrant,
  type GrantRecord,
  type GrantUser,
} from "@/lib/grant-api";

type VisibleRecord = GrantRecord & { ownerId: string; ownerName: string; owned: boolean };

export function Vault({ ownerId, sharedOnly = false }: { ownerId?: string; sharedOnly?: boolean }) {
  const { demoUser } = useDemoAccount();
  return (
    <VaultLayout>
      <Records
        key={`${demoUser}:${ownerId || "all"}:${sharedOnly}`}
        demoUser={demoUser}
        ownerId={ownerId}
        sharedOnly={sharedOnly}
      />
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
  const [filter, setFilter] = useState<"all" | "owned" | "shared">("all");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    async function load() {
      const account = await grantRequest<GrantUser>("/enroll", demoUser, { method: "POST" });
      const [owned, grants, role] = await Promise.all([
        grantRequest<GrantRecord[]>("/records", demoUser),
        grantRequest<AccessGrant[]>("/grants", demoUser),
        localGrantDemo
          ? Promise.resolve(demoUser === "patient" ? "patient" : "provider")
          : fetchRole(),
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
      if (!cancelled) {
        setRecords([...visible.values()]);
        setCanUpload(role === "patient");
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
  const filteredRecords = records.filter(
    (record) => filter === "all" || (filter === "owned" ? record.owned : !record.owned),
  );

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
              : "Your saved records and records shared with your account."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
        aria-label="Records"
        className="overflow-hidden rounded-xl border border-line/70 bg-surface/70"
      >
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
                ["shared", "Shared", records.length - ownedCount],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                disabled={loading || !!error}
                onClick={() => setFilter(value)}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora disabled:opacity-50 ${
                  filter === value ? "border-current bg-surface2" : "border-line"
                } ${value === "owned" ? "text-sky-300" : value === "shared" ? "text-violet-300" : "text-tx"}`}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        )}
        {error ? (
          <div role="alert" className="space-y-2 p-6 text-sm">
            <p className="text-red-400">{error}</p>
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
              {filter === "owned"
                ? "No owned records"
                : filter === "shared"
                  ? "No shared records"
                  : "No records yet"}
            </h2>
            <p className="mt-2 text-sm text-mut">
              {filter === "owned"
                ? "Records you own will appear here."
                : filter === "shared"
                  ? "Records with active access shared with you will appear here."
                  : "Records you own or that have been shared with you will appear here."}
            </p>
            <Link to="/access" className="mt-4 inline-block text-sm text-aurora">
              Open access ledger →
            </Link>
          </div>
        ) : (
          !loading && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line/50 text-xs uppercase tracking-wide text-mut">
                  <tr>
                    <th className="px-5 py-3 font-medium">Record</th>
                    <th className="px-5 py-3 font-medium">Record ID</th>
                    <th className="px-5 py-3 font-medium">Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/50">
                  {filteredRecords.map((record) => (
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
                      </td>
                      <td className="px-5 py-5 font-mono text-xs text-mut">{record.id}</td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
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
      {!sharedOnly && !ownerId && <SharedWithYouPanel refreshKey={refresh} />}
      <p className="text-xs text-mut">
        Click a document name to view it. Use the access ledger to share or revoke access.
      </p>
    </div>
  );
}
