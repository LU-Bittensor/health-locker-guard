import { identityFingerprint } from "@/lib/document-crypto";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDemoAccount } from "@/lib/demo-account";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { DocumentViewer } from "@/components/DocumentDialogs";
import {
  grantRequest,
  shareDocumentKey,
  localGrantDemo,
  type AccessGrant,
  type GrantRecord,
  type GrantUser,
} from "@/lib/grant-api";

import type { Address, Hex } from "viem";
import { enrollUnlockedVault } from "@/lib/vault-enroll";
import { getVaultSession } from "@/lib/vault-session";
import { isWalletRegistryGrant, sharingMode } from "@/lib/sharing-mode";
import {
  grantAccessOnChain,
  interimCommitment,
  proveAccessOnChain,
  registerResource,
  registryConfigured,
  revokeAccessOnChain,
  resourceIdFromRecord,
} from "@/lib/registry-wallet";

const field = "w-full rounded-md border border-line bg-surface2 px-2.5 py-2 text-[12px] text-tx";
const button = "rounded-md border border-line px-2.5 py-1.5 text-[12px] disabled:opacity-40";

export function AccessPanel() {
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
    <section
      aria-label="Manage record access"
      className="rounded-xl border border-line/70 bg-surface/80 p-4 text-tx sm:p-6"
    >
      {checking ? (
        <p role="status">Checking your account…</p>
      ) : !localGrantDemo && !account ? (
        <Link to="/signin" className="text-aurora underline">
          Sign in to manage access
        </Link>
      ) : (
        <AccountGrants key={account ?? demoUser} demoUser={demoUser} />
      )}
    </section>
  );
}

function AccountGrants({ demoUser }: { demoUser: string }) {
  const [chainEnabled, setChainEnabled] = useState(false);
  const [uploadsConfigured, setUploadsConfigured] = useState(true);
  const [storageBackend, setStorageBackend] = useState("");
  const [viewing, setViewing] = useState<GrantRecord | null>(null);
  const [me, setMe] = useState<GrantUser | null>(null);
  const [users, setUsers] = useState<GrantUser[]>([]);
  const [records, setRecords] = useState<GrantRecord[]>([]);
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [recipient, setRecipient] = useState("");
  const [scope, setScope] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [fingerprint, setFingerprint] = useState("");
  const mounted = useRef(true);
  const mutation = useRef(false);

  const refresh = useCallback(async () => {
    // Keep the authenticated report API compatible with vault-enrolled accounts.
    const session = getVaultSession();
    const account =
      !localGrantDemo && session
        ? await enrollUnlockedVault(demoUser)
        : await grantRequest<GrantUser>("/enroll", demoUser, { method: "POST" });
    const [nextUsers, nextRecords, nextGrants, health] = await Promise.all([
      grantRequest<GrantUser[]>("/users", demoUser),
      grantRequest<GrantRecord[]>("/records", demoUser),
      grantRequest<AccessGrant[]>("/grants", demoUser),
      grantRequest<{
        chain: boolean;
        document_uploads_configured?: boolean;
        document_storage_backend?: string;
      }>("/health", demoUser),
    ]);
    if (!mounted.current) return;
    setMe(account);
    if (session && !localGrantDemo) {
      const value = await identityFingerprint(
        session.userId,
        session.contents.evmAddress,
        session.contents.x25519PublicKeyB64,
      );
      if (mounted.current) setFingerprint(value);
    }
    setChainEnabled(health.chain);
    setUploadsConfigured(health.document_uploads_configured !== false);
    setStorageBackend(health.document_storage_backend ?? "");
    setUsers(nextUsers);
    setRecords(nextRecords);
    setSelectedIds((current) =>
      current.filter((id) => nextRecords.some((record) => record.id === id)),
    );
    setScope(
      (current) =>
        current ||
        (nextRecords.some((record) => record.kind === "Epic import")
          ? "Epic import"
          : "All records"),
    );
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
    const selected = records.filter((record) => selectedIds.includes(record.id));
    if (!selected.length) {
      setMessage("No records selected to grant.");
      return;
    }
    const granteeUser = users.find((user) => user.id === recipient);
    if (!granteeUser?.wallet) throw new Error("Recipient must enroll a vault wallet first.");

    if (
      sharingMode(selected, !localGrantDemo && chainEnabled && registryConfigured()) === "wallet"
    ) {
      const session = getVaultSession();
      if (!session || session.userId !== me?.id)
        throw new Error("Unlock your vault to sign grant transactions.");
      for (const record of selected) {
        await shareDocumentKey(record.id, granteeUser, demoUser);
        const dataCid = `medilink:record:${record.id}`;
        await registerResource({ recordId: record.id, dataCid });
        const resourceId = resourceIdFromRecord(record.id);
        const commitment = interimCommitment({
          ownerX25519PublicKeyB64: session.contents.x25519PublicKeyB64,
          grantee: granteeUser.wallet as Address,
          resourceId,
        });
        await grantAccessOnChain({
          recordId: record.id,
          grantee: granteeUser.wallet as Address,
          commitment,
        });
      }
      // The API discovers wallet grants from the registry and verifies document
      // ownership. Do not create a second, independently authorized API grant.
      const indexed = await grantRequest<AccessGrant[]>("/grants", demoUser);
      if (
        selected.some(
          (record) =>
            !indexed.some(
              (grant) => grant.id === `${record.id}:${recipient}` && grant.status === "active",
            ),
        )
      ) {
        throw new Error(
          "The wallet transaction confirmed, but the API could not verify the shared document. Refresh the access ledger before retrying.",
        );
      }
      if (!mounted.current) return;
      setGrants(indexed);
      setMessage(
        `Granted ${selected.length} record(s) on AccessRegistry from vault wallet ${me?.wallet}.`,
      );
      return;
    }

    if (!localGrantDemo) {
      for (const record of selected) await shareDocumentKey(record.id, granteeUser, demoUser);
    }
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
      `${active} of ${result.grants.length} record grants active. ${chainEnabled ? "Verified through the server's access registry." : "Local access control; blockchain verification is off."}`,
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
    if (isWalletRegistryGrant(grant) && grant.record_ids[0]) {
      const session = getVaultSession();
      if (!session || session.userId !== me?.id)
        throw new Error("Unlock your vault to revoke access.");
      const grantee = grant.recipient_wallet;
      if (!grantee) throw new Error("Recipient wallet unknown.");
      const tx = await revokeAccessOnChain({
        recordId: grant.record_ids[0],
        grantee: grantee as Address,
      });
      if (!mounted.current) return;
      setGrants((current) =>
        current.map((item) =>
          item.id === grant.id ? { ...item, status: "revoked", tx_hash: tx } : item,
        ),
      );
      setMessage("Access revoked on AccessRegistry with vault-signed transaction.");
      return;
    }
    const updated = await grantRequest<AccessGrant>(`/grants/${grant.id}`, demoUser, {
      method: "DELETE",
    });
    if (!mounted.current) return;
    setGrants((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setMessage(
      updated.status === "revoked" ? "Access revoked." : updated.error || "Revocation pending.",
    );
  }

  async function checkAccess(grant: AccessGrant) {
    if (isWalletRegistryGrant(grant) && grant.record_ids[0]) {
      const session = getVaultSession();
      if (!session || session.userId !== me?.id)
        throw new Error("Unlock your vault to prove access.");
      const resourceId = resourceIdFromRecord(grant.record_ids[0]);
      const ownerPub =
        users.find((user) => user.id === grant.owner_id)?.x25519PublicKeyB64 ||
        (grant.owner_id === me?.id ? session.contents.x25519PublicKeyB64 : null);
      if (!ownerPub) throw new Error("Owner X25519 public key unknown; owner must re-enroll.");
      // Grantee proves with the same interim commitment scheme used at grant time.
      const commitment = interimCommitment({
        ownerX25519PublicKeyB64: ownerPub,
        grantee: (me?.wallet || session.contents.evmAddress) as Address,
        resourceId,
      }) as Hex;
      const result = await proveAccessOnChain({
        recordId: grant.record_ids[0],
        commitment,
      });
      if (mounted.current)
        setMessage(
          result.granted
            ? `Access proven on-chain for ${grant.record_name}. verify tx: ${result.verifyTx}`
            : `On-chain verify submitted (${result.verifyTx}) but grant check returned false.`,
        );
      return;
    }
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
      {grant.status === "active" && grant.document?.has_document && (
        <button className={button} disabled={busy} onClick={() => setViewing(grant.document!)}>
          Open shared content
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
      {fingerprint && (
        <p className="break-all text-mut">
          Your encryption fingerprint: <code>{fingerprint}</code>. Share this through a trusted
          channel so others can verify your vault before sharing documents.
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
              ? "Server access control · blockchain verification is on"
              : "Server access control · blockchain verification is off"}
          </p>
          {!localGrantDemo && chainEnabled && registryConfigured() && (
            <p className="text-mut">
              Encrypted Epic imports and uploaded documents use your vault to share access. Legacy
              Epic reports use server access controls and must be shared separately.
            </p>
          )}
          {storageBackend === "local" && (
            <p className="text-mut">
              Documents are stored encrypted on this computer. Keep the local API running so
              recipients can open shared records.
            </p>
          )}
          {!uploadsConfigured && (
            <p className="text-mut">
              Uploaded document storage is not configured here. Existing legacy Epic reports may
              still be available. New encrypted imports require document storage to be configured.
            </p>
          )}
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
                onChange={(event) => {
                  setScope(event.target.value);
                  setSelectedIds([]);
                }}
                disabled={busy}
              >
                <option>All records</option>
                {[...new Set(records.map((record) => record.kind))].map((kind) => (
                  <option key={kind}>{kind}</option>
                ))}
              </select>
              <p className="text-mut">
                Choose the saved records you want this recipient to receive. Later imports are
                separate snapshots and are never added to an existing grant.
              </p>
              <div className="space-y-2 rounded-md border border-line p-3">
                <p className="font-medium">
                  Choose content to share ({selectedIds.length} selected)
                </p>
                {records
                  .filter((record) => scope === "All records" || record.kind === scope)
                  .map((record) => (
                    <div key={record.id} className="space-y-1">
                      <label className="flex items-start gap-2 break-words">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(record.id)}
                          disabled={busy}
                          onChange={(event) =>
                            setSelectedIds((current) =>
                              event.target.checked
                                ? [...current, record.id]
                                : current.filter((id) => id !== record.id),
                            )
                          }
                        />
                        <span>{record.name}</span>
                      </label>
                      <p className="text-mut">
                        {record.kind}
                        {record.client_encrypted ? " · Encrypted" : ""}
                      </p>
                      {record.share_note && <p className="text-mut">{record.share_note}</p>}
                      {record.has_document && (
                        <button
                          className={button}
                          disabled={busy}
                          onClick={() => setViewing(record)}
                        >
                          Review content before sharing
                        </button>
                      )}
                    </div>
                  ))}
              </div>
              <button
                className={`${button} w-full border-aurora/40 text-aurora`}
                disabled={busy || !recipient || !selectedIds.length}
                onClick={() => void perform(grantAccess)}
              >
                {busy ? "Working…" : `Grant ${selectedIds.length} selected record(s)`}
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
            Open shared content to view an authorized report. Revoking access blocks future opens,
            but cannot remove a copy already viewed or saved.
          </p>
        </>
      )}
      {viewing && (
        <DocumentViewer record={viewing} demoUser={demoUser} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}
