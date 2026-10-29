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
export type GrantRecord = { id: string; name: string; kind: string };
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
  const response = await fetch(`${apiBase}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Grant request failed.");
  return body as T;
}
