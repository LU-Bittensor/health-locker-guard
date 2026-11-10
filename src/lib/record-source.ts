import type { GrantRecord } from "@/lib/grant-api";

export type RecordSource = "epic" | "medilink";

/** Classify saved snapshots consistently for owned and incoming record metadata. */
export function recordSource(record: Pick<GrantRecord, "id" | "kind">): RecordSource {
  return record.kind === "Epic import" ||
    record.kind === "Epic import (legacy)" ||
    record.id.startsWith("epic-import-")
    ? "epic"
    : "medilink";
}
