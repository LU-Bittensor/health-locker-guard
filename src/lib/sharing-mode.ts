import type { AccessGrant, GrantRecord } from "@/lib/grant-api";

/** Legacy Epic reports use the API; encrypted imports use the document wallet path. */
export function sharingMode(records: Pick<GrantRecord, "id">[], walletRegistryConfigured: boolean) {
  if (!walletRegistryConfigured) return "api";
  const reports = records.filter((record) => record.id.startsWith("epic-import-"));
  if (reports.length && reports.length !== records.length) {
    throw new Error("Share Epic reports separately from uploaded documents. Choose a record type.");
  }
  return reports.length ? "api" : "wallet";
}

/** Wallet grants use composite IDs; API grants keep their server-generated UUIDs. */
export function isWalletRegistryGrant(
  grant: Pick<AccessGrant, "id" | "chain_enabled" | "record_ids" | "recipient_id">,
) {
  return (
    grant.chain_enabled &&
    grant.record_ids.length === 1 &&
    grant.id === `${grant.record_ids[0]}:${grant.recipient_id}`
  );
}
