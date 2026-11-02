import { supabase } from "@/integrations/supabase/client";

// Never include fixture authentication in a production build.
export const localGrantDemo = import.meta.env.DEV && import.meta.env["VITE_GRANT_DEMO"] === "true";
const apiBase = import.meta.env["VITE_GRANT_API_URL"] || "http://127.0.0.1:5001";
export type GrantUser = {
  id: string;
  name: string;
  wallet: string;
  x25519PublicKeyB64?: string | null;
};
export type GrantRecord = {
  id: string;
  name: string;
  kind: string;
  owner_id?: string;
  tags?: string[];
  mime_type?: string | null;
  size?: number | null;
  has_document?: boolean;
  created_at?: string;
};
export type AccessGrant = {
  id: string;
  owner_id: string;
  owner_name: string;
  recipient_id: string;
  recipient_name: string;
  scope: string;
  record_name: string;
  contract_address: string | null;
  deploy_tx: string | null;
  register_tx: string | null;
  kill_tx: string | null;
  contract_killed: boolean;
  chain_enabled: boolean;
  record_ids: string[];
  status: "pending" | "active" | "failed" | "revoking" | "revoked";
  tx_hash: string | null;
  error: string | null;
};

export async function grantRequest<T>(
  path: string,
  demoUser: string,
  init: RequestInit = {},
): Promise<T> {
  let token: string | undefined;
  if (localGrantDemo) {
    if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      throw new Error("The grant demo is available only on localhost.");
    }
    token = `demo-${demoUser}`;
  } else {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    token = data.session?.access_token;
    if (!token) throw new Error("Sign in to manage access.");
  }
  // Let the browser set multipart boundaries; never force JSON on FormData.
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const response = await fetch(`${apiBase}/api${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...init.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Grant request failed.");
  return body as T;
}

/** List documents owned by the signed-in user (grant API → Supabase records). */
export async function listOwnedRecords(demoUser = "patient"): Promise<GrantRecord[]> {
  return grantRequest<GrantRecord[]>("/records", demoUser);
}

/** Upload a document file through the grant API (stores bytes in Supabase file_content). */
export async function uploadOwnedRecord(
  input: { file: File; tags?: string; kind?: string },
  demoUser = "patient",
): Promise<GrantRecord> {
  const form = new FormData();
  form.append("file", input.file, input.file.name);
  if (input.tags?.trim()) form.append("tags", input.tags.trim());
  if (input.kind?.trim()) form.append("kind", input.kind.trim());
  return grantRequest<GrantRecord>("/records", demoUser, { method: "POST", body: form });
}
