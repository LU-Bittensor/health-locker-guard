import { useCallback, useEffect, useRef, useState } from "react";
import { useDemoAccount } from "@/lib/demo-account";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const { demoUser } = useDemoAccount();
  return (
    <section
      aria-label="Manage record access"
      className="rounded-xl border border-line/70 bg-surface/80 p-4 text-tx sm:p-6"
    >
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
      `${active} of ${result.grants.length} record grants active. ${chainEnabled ? "All records use the shared access registry." : "Off-chain mode: no contracts deployed."}`,
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
        ? "Recipient grant registered on-chain."
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
        ? updated.registry_revoked
          ? "Access revoked in the registry."
          : "Access revoked. No on-chain grant needs removal."
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

  const activeGrants = grants.filter((grant) => grant.status === "active");
  const outgoingGrants = activeGrants.filter((grant) => grant.owner_id === me?.id);
  const incomingGrants = activeGrants.filter((grant) => grant.recipient_id === me?.id);
  const revokedGrants = grants.filter((grant) => ["revoked", "revoking"].includes(grant.status));
  const setupGrants = grants.filter((grant) => ["pending", "failed"].includes(grant.status));

  const renderGrant = (grant: AccessGrant) => (
    <div key={grant.id} className="space-y-2 rounded-md border border-line p-3">
      <h3 className="break-words text-lg font-semibold leading-snug sm:text-xl">
        {grant.record_name}
      </h3>
      <p className="text-mut">{grant.scope}</p>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-mut">Sender</dt>
          <dd className="break-words font-medium text-sky-300">{grant.owner_name}</dd>
        </div>
        <div>
          <dt className="text-xs text-mut">Recipient</dt>
          <dd className="break-words font-medium text-violet-300">{grant.recipient_name}</dd>
        </div>
      </dl>
      <p className="capitalize">Status: {grant.status}</p>
      {grant.error && <p className="text-mut">{grant.error}</p>}
      {grant.contract_address && (
        <p className="break-all text-[11px]">Registry: {grant.contract_address}</p>
      )}
      {grant.chain_enabled && (
        <>
          <p className="break-all text-[11px]">Resource ID: {grant.resource_id}</p>
          <p className="break-all text-[11px]">Recipient wallet: {grant.recipient_wallet}</p>
        </>
      )}
      {grant.resource_tx && (
        <details className="text-mut">
          <summary>Resource registration transaction</summary>
          <p className="break-all">{grant.resource_tx}</p>
        </details>
      )}
      {grant.deploy_tx && (
        <details className="text-mut">
          <summary>Registry deployment transaction</summary>
          <p className="break-all">{grant.deploy_tx}</p>
        </details>
      )}
      {grant.register_tx && (
        <details className="text-mut">
          <summary>Grant transaction</summary>
          <p className="break-all">{grant.register_tx}</p>
        </details>
      )}
      {grant.registry_revoked && <p>Recipient grant removed from registry</p>}
      {grant.revoke_tx && (
        <details className="text-mut">
          <summary>Revocation transaction</summary>
          <p className="break-all">{grant.revoke_tx}</p>
        </details>
      )}
      {grant.status === "revoking" && (
        <p className="text-mut">API access blocked. Registry revocation awaiting confirmation.</p>
      )}
      {grant.owner_id === me?.id && grant.status === "pending" && (
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
      {grant.owner_id === me?.id &&
        ["active", "pending", "failed", "revoking"].includes(grant.status) && (
          <button
            className={button}
            disabled={busy}
            onClick={() => void perform(() => revoke(grant))}
          >
            {grant.status === "revoking" ? "Retry revocation" : "Revoke"}
          </button>
        )}
      {grant.recipient_id === me?.id && (
        <button
          className={button}
          disabled={busy}
          onClick={() => void perform(() => checkAccess(grant))}
        >
          Check access
        </button>
      )}
    </div>
  );

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
              ? "Blockchain connected · shared AccessRegistry"
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
                Shares each matching record separately. Each recipient gets a separate credential in
                the shared registry when blockchain mode is enabled.
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
          <Tabs defaultValue="active" className="pt-3">
            <TabsList
              aria-label="Access grant status"
              className="grid w-full grid-cols-2 bg-surface2 text-mut"
            >
              <TabsTrigger
                value="active"
                className="data-[state=active]:bg-ink data-[state=active]:text-aurora"
              >
                Active ({activeGrants.length})
              </TabsTrigger>
              <TabsTrigger
                value="revoked"
                className="data-[state=active]:bg-ink data-[state=active]:text-rose-300"
              >
                Revoked ({revokedGrants.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="space-y-3 pt-2">
              <section aria-label="Active outgoing receipts" className="space-y-3">
                <h2 className="text-sm font-semibold text-sky-300">
                  Active outgoing receipts ({outgoingGrants.length})
                </h2>
                <p className="text-mut">Records you have shared with others.</p>
                {outgoingGrants.length ? (
                  outgoingGrants.map(renderGrant)
                ) : (
                  <p className="py-3 text-mut">No active outgoing receipts.</p>
                )}
              </section>
              <section
                aria-label="Active incoming receipts"
                className="space-y-3 border-t border-line pt-4"
              >
                <h2 className="text-sm font-semibold text-violet-300">
                  Active incoming receipts ({incomingGrants.length})
                </h2>
                <p className="text-mut">Records others have shared with you.</p>
                {incomingGrants.length ? (
                  incomingGrants.map(renderGrant)
                ) : (
                  <p className="py-3 text-mut">No active incoming receipts.</p>
                )}
              </section>
            </TabsContent>
            <TabsContent value="revoked" className="space-y-3 pt-2">
              <p className="text-mut">
                Access is blocked for these grants, including any awaiting registry revocation.
              </p>
              {revokedGrants.length === 0 ? (
                <p className="py-4 text-center text-mut">No revoked access grants.</p>
              ) : (
                revokedGrants.map(renderGrant)
              )}
            </TabsContent>
          </Tabs>
          {setupGrants.length > 0 && (
            <section
              aria-label="Setup needs attention"
              className="space-y-3 border-t border-line pt-4"
            >
              <h2 className="text-sm font-semibold text-amber-300">
                Setup needs attention ({setupGrants.length})
              </h2>
              <p className="text-mut">
                These grants are not active. Complete setup or revoke them below.
              </p>
              {setupGrants.map(renderGrant)}
            </section>
          )}
          <p className="text-mut">
            This panel verifies permissions and key sharing. Record downloads are not connected yet.
          </p>
        </>
      )}
    </div>
  );
}
