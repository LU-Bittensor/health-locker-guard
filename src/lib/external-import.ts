import { grantRequest, localGrantDemo } from "@/lib/grant-api";

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
  status: "idle" | "running" | "completed" | "failed";
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
