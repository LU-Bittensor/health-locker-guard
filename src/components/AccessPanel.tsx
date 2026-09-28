import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  grantRequest,
  localGrantDemo,
  type AccessGrant,
  type GrantRecord,
  type GrantUser,
} from "@/lib/grant-api";

const field = "w-full rounded-md border border-line bg-surface2 px-2.5 py-2 text-[12px] text-tx";
const button = "rounded-md border border-line px-2.5 py-1.5 text-[12px] disabled:opacity-40";

export function AccessPanel() {
  const [demoUser, setDemoUser] = useState("patient");
  // Remount on demo identity changes so no previous account's data remains visible.
  return (
    <section className="rounded-xl border border-line/70 bg-surface/80 p-4 text-tx">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider">Access ledger</h2>
      {localGrantDemo && (
        <div className="my-3 space-y-2 rounded-md border border-aurora/40 p-2">
          <p className="text-[12px] text-aurora">Local demo · fixture accounts and records</p>
          <label className="text-[12px]" htmlFor="demo-account">
            Test as
          </label>
          <select
            id="demo-account"
            className={field}
            value={demoUser}
            onChange={(event) => setDemoUser(event.target.value)}
          >
            <option value="patient">Demo patient</option>
            <option value="clinician">Demo clinician</option>
            <option value="outsider">Unrelated user</option>
          </select>
        </div>
      )}
      <AccountGrants key={demoUser} demoUser={demoUser} />
    </section>
  );
}

function AccountGrants({ demoUser }: { demoUser: string }) {
  const [chainEnabled, setChainEnabled] = useState(false);
  const [me, setMe] = useState<GrantUser | null>(null);
  const [users, setUsers] = useState<GrantUser[]>([]);
  const [records, setRecords] = useState<GrantRecord[]>([]);
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [recipient, setRecipient] = useState("");
  const [scope, setScope] = useState("All records");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const mounted = useRef(true);
  const mutation = useRef(false);

  const refresh = useCallback(async () => {
    const account = await grantRequest<GrantUser>("/enroll", demoUser, { method: "POST" });
    const [nextUsers, nextRecords, nextGrants, health] = await Promise.all([
      grantRequest<GrantUser[]>("/users", demoUser),
      grantRequest<GrantRecord[]>("/records", demoUser),
      grantRequest<AccessGrant[]>("/grants", demoUser),
      grantRequest<{ chain: boolean }>("/health", demoUser),
    ]);
    if (!mounted.current) return;
    setMe(account);
    setChainEnabled(health.chain);
    setUsers(nextUsers);
    setRecords(nextRecords);
    setGrants(nextGrants);
  }, [demoUser]);

  useEffect(() => {
    mounted.current = true;
    void refresh()
      .catch((cause: unknown) => {
        if (mounted.current)
          setError(cause instanceof Error ? cause.message : "Could not load grants.");
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  async function perform(action: () => Promise<void>) {
    if (mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Request failed.");
    } finally {
      mutation.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function grantAccess() {
    const selected = records.filter((record) => scope === "All records" || record.kind === scope);
    const result = await grantRequest<{ grants: AccessGrant[] }>("/grants", demoUser, {
      method: "POST",
      body: JSON.stringify({
        recipient_id: recipient,
        record_ids: selected.map((record) => record.id),
      }),
    });
    if (!mounted.current) return;
    setGrants((current) => [
      ...result.grants,
      ...current.filter((item) => !result.grants.some((grant) => grant.id === item.id)),
    ]);
    const active = result.grants.filter((grant) => grant.status === "active").length;
    setMessage(
      `${active} of ${result.grants.length} record grants active. ${chainEnabled ? "Each record uses its own contract." : "Off-chain mode: no contracts deployed."}`,
    );
  }

  async function resumeSetup(grant: AccessGrant) {
    const updated = await grantRequest<AccessGrant>(`/grants/${grant.id}/resume`, demoUser, {
      method: "POST",
    });
    if (!mounted.current) return;
    setGrants((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setMessage(
      updated.status === "active"
        ? "Contract deployed and commitment registered."
        : updated.error || "Waiting for transaction confirmation.",
    );
  }

  async function revoke(grant: AccessGrant) {
    const updated = await grantRequest<AccessGrant>(`/grants/${grant.id}`, demoUser, {
      method: "DELETE",
    });
    if (!mounted.current) return;
    setGrants((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setMessage(
      updated.status === "revoked"
        ? updated.contract_killed
          ? "Access revoked. Contract permanently disabled on-chain."
          : "Access revoked. No deployed contract needs disabling."
        : updated.error || "Revocation pending.",
    );
  }

  async function checkAccess(grant: AccessGrant) {
    const result = await grantRequest<{
      record_ids: string[];
      chain_verified: boolean;
      verify_tx?: string;
    }>(`/grants/${grant.id}/access`, demoUser, { method: "POST" });
    if (mounted.current)
      setMessage(
        result.chain_verified
          ? `AccessGranted confirmed on-chain for ${grant.record_name}. Verification transaction: ${result.verify_tx}`
          : `DH keys match for ${grant.record_name}. Off-chain check only; no contract was called.`,
      );
  }

  return (
    <div className="mt-3 space-y-3 text-[12px]">
      <div className="flex items-center justify-between gap-2">
        <span>{loading ? "Loading grants…" : me?.name}</span>
        <button className={button} disabled={busy || loading} onClick={() => void perform(refresh)}>
          Refresh
        </button>
      </div>
      {error && (
        <p role="alert" className="break-words text-red-400">
          {error}{" "}
          {!localGrantDemo && (
            <Link to="/signin" className="underline">
              Sign in
            </Link>
          )}
        </p>
      )}
      {message && (
        <p role="status" className="break-all text-aurora">
          {message}
        </p>
      )}
      {me && (
        <>
          <p className="text-mut">
            {chainEnabled
              ? "Blockchain connected · one contract per recipient and record"
              : "Off-chain demo · start the API with --chain to deploy contracts"}
          </p>
          {chainEnabled && (
            <details className="text-mut">
              <summary>Recipient transaction wallet</summary>
              <p className="break-all">{me.wallet}</p>
            </details>
          )}
          {records.length > 0 ? (
            <div className="space-y-2 border-y border-line py-3">
              <label htmlFor="grant-recipient">Grant access to</label>
              <select
                id="grant-recipient"
                className={field}
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                disabled={busy}
              >
                <option value="">Select a registered user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.id.slice(0, 8)})
                  </option>
                ))}
              </select>
              <label htmlFor="grant-scope">Records to share</label>
              <select
                id="grant-scope"
                className={field}
                value={scope}
                onChange={(event) => setScope(event.target.value)}
                disabled={busy}
              >
                <option>All records</option>
                {[...new Set(records.map((record) => record.kind))].map((kind) => (
                  <option key={kind}>{kind}</option>
                ))}
              </select>
              <p className="text-mut">
                Shares each matching record separately. Each recipient–record pair gets its own
                contract when blockchain mode is enabled.
              </p>
              <button
                className={`${button} w-full border-aurora/40 text-aurora`}
                disabled={busy || !recipient}
                onClick={() => void perform(grantAccess)}
              >
                {busy ? "Working…" : "Grant"}
              </button>
            </div>
          ) : (
            <p className="text-mut">No saved records to share. Incoming grants appear below.</p>
          )}
          {users.length === 0 && (
            <p className="text-mut">
              Recipients must sign in and open this panel once before you can select them.
            </p>
          )}
          {grants.length === 0 && <p className="text-mut">No grants for this account.</p>}
          {grants.map((grant) => (
            <div key={grant.id} className="space-y-2 rounded-md border border-line p-3">
              <p className="font-medium">
                {grant.owner_id === me.id
                  ? `To ${grant.recipient_name}`
                  : `From ${grant.owner_name}`}
              </p>
              <p>
                {grant.record_name} · {grant.scope}
              </p>
              <p className="capitalize">Status: {grant.status}</p>
              {grant.error && <p className="text-mut">{grant.error}</p>}
              {grant.contract_address && (
                <p className="break-all text-[11px]">Contract: {grant.contract_address}</p>
              )}
              {grant.deploy_tx && (
                <details className="text-mut">
                  <summary>Deployment transaction</summary>
                  <p className="break-all">{grant.deploy_tx}</p>
                </details>
              )}
              {grant.register_tx && (
                <details className="text-mut">
                  <summary>Commitment transaction</summary>
                  <p className="break-all">{grant.register_tx}</p>
                </details>
              )}
              {grant.contract_killed && <p>Contract permanently disabled</p>}
              {grant.kill_tx && (
                <details className="text-mut">
                  <summary>Revocation transaction</summary>
                  <p className="break-all">{grant.kill_tx}</p>
                </details>
              )}
              {grant.status === "revoking" && (
                <p className="text-mut">
                  API access blocked. Contract disablement awaiting confirmation.
                </p>
              )}
              {grant.owner_id === me.id && grant.status === "pending" && (
                <button
                  className={button}
                  disabled={busy}
                  onClick={() => void perform(() => resumeSetup(grant))}
                >
                  Resume setup
                </button>
              )}
              {grant.tx_hash && !grant.deploy_tx && (
                <p className="break-all text-[10px] text-mut">Transaction: {grant.tx_hash}</p>
              )}
              {grant.owner_id === me.id &&
                ["active", "pending", "failed", "revoking"].includes(grant.status) && (
                  <button
                    className={button}
                    disabled={busy}
                    onClick={() => void perform(() => revoke(grant))}
                  >
                    {grant.status === "revoking" ? "Retry revocation" : "Revoke"}
                  </button>
                )}
              {grant.recipient_id === me.id && (
                <button
                  className={button}
                  disabled={busy}
                  onClick={() => void perform(() => checkAccess(grant))}
                >
                  Check access
                </button>
              )}
            </div>
          ))}
          <p className="text-mut">
            This panel verifies permissions and key sharing. Record downloads are not connected yet.
          </p>
        </>
      )}
    </div>
  );
}
