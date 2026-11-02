import { useCallback, useEffect, useState } from "react";

import {
  listSharedGrantsForVault,
  registryConfigured,
  vaultEvmAddress,
  type SharedOnChainGrant,
} from "@/lib/registry-wallet";

const button =
  "rounded-md border border-line px-2.5 py-1.5 text-[12px] disabled:opacity-40 hover:border-aurora/50";

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function SharedWithYouPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [items, setItems] = useState<SharedOnChainGrant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const configured = registryConfigured();

  const refresh = useCallback(async () => {
    if (!configured) {
      setItems([]);
      setError("");
      return;
    }
    if (!vaultEvmAddress()) {
      setItems([]);
      setError("Unlock your vault to poll AccessGrantSet for your address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      setItems(await listSharedGrantsForVault());
    } catch (cause) {
      setItems([]);
      setError(cause instanceof Error ? cause.message : "Could not load on-chain shares.");
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  if (!configured) {
    return (
      <div className="mt-4 overflow-hidden rounded-xl border border-line/70 bg-surface/60 p-4 backdrop-blur-xl">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mut">
          Shared with you
        </h2>
        <p className="mt-2 text-[12px] text-mut">
          Set <code className="font-mono">VITE_ACCESS_REGISTRY</code> to discover on-chain grants.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-line/70 bg-surface/60 backdrop-blur-xl">
      <div className="flex h-11 items-center justify-between border-b border-line/70 px-4">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mut">
          Shared with you
        </h2>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-mut">
            {loading ? "…" : `${items.length} active`}
          </span>
          <button type="button" className={button} disabled={loading} onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
      </div>
      <p className="border-b border-line/50 px-4 py-2 text-[11px] text-mut">
        Polls AccessRegistry <code className="font-mono">AccessGrantSet</code> for your vault
        address, then confirms with <code className="font-mono">hasGrant</code>.
      </p>
      {error && (
        <p role="alert" className="px-4 py-3 text-[12px] text-aurora">
          {error}
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="px-4 py-6 text-[12px] text-mut">
          No active on-chain shares for this vault yet. Another user must Grant to your enrolled
          address.
        </p>
      )}
      <div className="divide-y divide-line/50 text-[13px]">
        {items.map((item) => (
          <div key={item.resourceId} className="space-y-1 px-4 py-3">
            <div className="font-medium text-tx">
              {item.recordId ? `Record ${item.recordId}` : item.dataCid || "Shared resource"}
            </div>
            <p className="break-all font-mono text-[11px] text-mut">cid: {item.dataCid}</p>
            <p className="font-mono text-[11px] text-mut">owner: {shortAddr(item.owner)}</p>
            {item.grantTxHash && (
              <p className="break-all font-mono text-[10px] text-mut">tx: {item.grantTxHash}</p>
            )}
            {item.blockNumber != null && (
              <p className="font-mono text-[10px] text-mut">block: {item.blockNumber.toString()}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
