import { getVaultSession } from "@/lib/vault-session";
import { enrollUnlockedVault } from "@/lib/vault-enroll";
import { grantRequest, localGrantDemo, uploadDocument, viewDocument } from "@/lib/grant-api";

export type EpicConnection = {
  token_exchange_succeeded: boolean;
  ready_for_transfer: boolean;
  ready_for_import?: boolean;
  reason: string;
  expires_at?: number;
  scopes?: string[];
  patient_context_received?: boolean;
};
export type EpicImport = {
  id?: string;
  client_encrypted?: boolean;
  status: "idle" | "running" | "awaiting_encryption" | "completed" | "failed";
  message: string;
  completed_steps?: number;
  total_steps?: number;
  completed_at?: number;
  counts?: Record<string, number>;
  queries?: {
    resourceType: string;
    category: string | null;
    pages: number;
    returnedEntries: number;
  }[];
  notices?: { resource_type: string; severity: string; codes: string[] }[];
  mapping_warning_count?: number;
  digest_verified?: boolean;
  coverage_note?: string;
};
export function epicRequest<T>(action: string, body?: Record<string, string>) {
  if (localGrantDemo)
    return Promise.reject(
      new Error("Epic requires a real MediLink login. Disable VITE_GRANT_DEMO first."),
    );
  return grantRequest<T>(
    `/external-import/epic/${action}`,
    "",
    body === undefined
      ? {}
      : {
          method: "POST",
          body: JSON.stringify(body),
        },
  );
}

export async function prepareEpicImport() {
  if (!getVaultSession()) throw new Error("Unlock your vault before importing Epic records.");
  await enrollUnlockedVault("");
}
const saving = new Map<string, Promise<EpicImport>>();
export function saveEpicImport(jobId: string): Promise<EpicImport> {
  const session = getVaultSession();
  if (!session)
    return Promise.reject(new Error("Unlock your vault to encrypt and save this import."));
  const key = `${session.userId}:${jobId}`;
  const existing = saving.get(key);
  if (existing) return existing;
  const task = (async () => {
    const result = await epicRequest<{ stored: boolean; snapshot?: unknown }>(
      `import/${encodeURIComponent(jobId)}/payload`,
    );
    if (getVaultSession() !== session)
      throw new Error("Vault changed during import. Unlock the original account.");
    if (!result.stored) {
      if (!result.snapshot) throw new Error("Import payload unavailable.");
      const file = new File(
        [JSON.stringify(result.snapshot)],
        `Epic-snapshot-${jobId.slice(0, 8)}.txt`,
        {
          type: "text/plain",
        },
      );
      await uploadDocument(
        file,
        "Epic, encrypted snapshot",
        "",
        "Epic import",
        jobId,
        session.userId,
      );
    }
    if (getVaultSession() !== session) throw new Error("Vault changed during import.");
    return epicRequest<EpicImport>(`import/${encodeURIComponent(jobId)}/complete`, {});
  })().finally(() => saving.delete(key));
  saving.set(key, task);
  return task;
}

export type ClinicalRecord = {
  id: string;
  category: string;
  name: string;
  value: string | null;
  unit: string | null;
  date: string | null;
  status: string | null;
  source: string;
};
export type EpicRecordPage = {
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
export function snapshotPage(
  snapshot: {
    format: string;
    records: ClinicalRecord[];
    imported_at: number;
    audit?: { warnings?: unknown[] };
    coverage_note?: string;
  },
  category: string,
  page: number,
): EpicRecordPage {
  if (snapshot.format !== "medilink-epic-snapshot-v1" || !Array.isArray(snapshot.records))
    throw new Error("Invalid encrypted Epic snapshot.");
  const categories = ["vital-signs", "laboratory", "conditions", "medications", "encounters"];
  const counts = Object.fromEntries(
    categories.map((c) => [c, snapshot.records.filter((r) => r.category === c).length]),
  );
  const selected = snapshot.records
    .filter((r) => category === "all" || r.category === category)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.id.localeCompare(a.id));
  return {
    records: selected.slice((page - 1) * 25, page * 25),
    total: selected.length,
    counts,
    page,
    page_size: 25,
    imported_at: snapshot.imported_at,
    digest_verified: true,
    mapping_warning_count: snapshot.audit?.warnings?.length ?? 0,
    coverage_note: snapshot.coverage_note ?? "",
  };
}
export async function loadEpicRecords(category: string, page: number): Promise<EpicRecordPage> {
  const result = await epicRequest<
    EpicRecordPage & { client_encrypted?: boolean; record_id?: string }
  >(`records?category=${category}&page=${page}`);
  if (!result.client_encrypted || !result.record_id) return result;
  const session = getVaultSession();
  const blob = await viewDocument(result.record_id, "", new AbortController().signal);
  const snapshot = JSON.parse(await blob.text());
  if (!session || getVaultSession() !== session)
    throw new Error("Vault changed while opening Epic records.");
  return snapshotPage(snapshot, category, page);
}
