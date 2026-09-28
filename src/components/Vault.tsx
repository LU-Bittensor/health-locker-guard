import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
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
  const [records, setRecords] = useState<VisibleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    async function load() {
      const account = await grantRequest<GrantUser>("/enroll", demoUser, { method: "POST" });
      const [owned, grants] = await Promise.all([
        grantRequest<GrantRecord[]>("/records", demoUser),
        grantRequest<AccessGrant[]>("/grants", demoUser),
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
            ownerId: grant.owner_id,
            ownerName: grant.owner_name,
            owned: false,
          });
      }
      if (!cancelled) setRecords([...visible.values()]);
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
        <Link
          to="/access"
          className="rounded-lg gradient-aurora px-4 py-2.5 text-sm font-semibold text-ink"
        >
          Manage access
        </Link>
      </div>
      <section
        aria-label="Records"
        className="overflow-hidden rounded-xl border border-line/70 bg-surface/70"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <span className="text-sm text-mut" role="status">
            {loading
              ? "Loading records…"
              : `${records.length} record${records.length === 1 ? "" : "s"}`}
          </span>
          <button
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
            className="rounded-md border border-line px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Refresh records
          </button>
        </div>
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
        ) : !loading && records.length === 0 ? (
          <div className="p-8 text-center">
            <h2 className="font-medium">No records yet</h2>
            <p className="mt-2 text-sm text-mut">
              No records are available for this account yet. Records you own or that have been
              shared with you will appear here.
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
                  {records.map((record) => (
                    <tr key={`${record.ownerId}:${record.id}`}>
                      <td className="px-5 py-5">
                        <p className="font-medium">{record.name}</p>
                        <p className="mt-1 text-xs text-mut">{record.kind}</p>
                      </td>
                      <td className="px-5 py-5 font-mono text-xs text-mut">{record.id}</td>
                      <td className="px-5 py-5">
                        <span className="text-aurora">
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
      <p className="text-xs text-mut">
        Use the access ledger to grant, verify, or revoke access. File uploads and downloads are not
        connected yet.
      </p>
    </div>
  );
}
