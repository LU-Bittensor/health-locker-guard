import { grantRequest, localGrantDemo } from "@/lib/grant-api";

export type EpicConnection = {
  token_exchange_succeeded: boolean;
  ready_for_transfer: boolean;
  reason: string;
  expires_at?: number;
  scopes?: string[];
  patient_context_received?: boolean;
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
