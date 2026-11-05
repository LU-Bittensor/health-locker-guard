import { supabase } from "@/integrations/supabase/client";

// Never include fixture authentication in a production build.
export const localGrantDemo = import.meta.env.DEV && import.meta.env["VITE_GRANT_DEMO"] === "true";
const apiBase = import.meta.env["VITE_GRANT_API_URL"] || "http://127.0.0.1:5001";
export type GrantUser = { id: string; name: string; wallet: string };
export type GrantRecord = {
  id: string;
  name: string;
  kind: string;
  tags?: string[];
  has_document?: boolean;
  mime_type?: string;
  share_note?: string;
};
export type AccessGrant = {
  id: string;
  document?: GrantRecord | null;
  owner_id: string;
  owner_name: string;
  recipient_id: string;
  recipient_name: string;
  scope: string;
  record_name: string;
  contract_address: string | null;
  deploy_tx: string | null;
  resource_tx: string | null;
  resource_id: string;
  recipient_wallet: string;
  register_tx: string | null;
  revoke_tx: string | null;
  registry_revoked: boolean;
  chain_enabled: boolean;
  record_ids: string[];
  status: "pending" | "active" | "failed" | "revoking" | "revoked";
  tx_hash: string | null;
  error: string | null;
};

async function authenticatedRequest(
  path: string,
  demoUser: string,
  init: RequestInit = {},
): Promise<Response> {
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
  const response = await fetch(`${apiBase}/api${path}`, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Request failed. Please try again.");
  }
  return response;
}

export async function grantRequest<T>(
  path: string,
  demoUser: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await authenticatedRequest(path, demoUser, init);
  return response.json() as Promise<T>;
}

export async function uploadDocument(file: File, tags: string, demoUser: string) {
  const body = new FormData();
  body.append("file", file);
  body.append("tags", tags);
  return grantRequest<GrantRecord>("/records", demoUser, { method: "POST", body });
}

export async function viewDocument(id: string, demoUser: string, signal: AbortSignal) {
  const response = await authenticatedRequest(
    `/records/${encodeURIComponent(id)}/document`,
    demoUser,
    { method: "POST", signal },
  );
  return response.blob();
}
