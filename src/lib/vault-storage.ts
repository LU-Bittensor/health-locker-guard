import { grantRequest } from "@/lib/grant-api";
import { isVaultBlob, type VaultBlob } from "@/lib/vault-crypto";

type PresignResponse = {
  url: string;
  method: "PUT" | "GET";
  object_key: string;
  backend: "hippius" | "local";
  headers?: Record<string, string>;
};

export type VaultStatus = {
  exists: boolean;
  user_id: string;
  object_key: string;
  backend: "hippius" | "local";
};

/** demoUser is ignored unless VITE_GRANT_DEMO is enabled. */
const DEMO_PLACEHOLDER = "patient";

export async function fetchVaultStatus(demoUser = DEMO_PLACEHOLDER): Promise<VaultStatus> {
  return grantRequest<VaultStatus>("/vault/status", demoUser);
}

export async function uploadVaultBlob(blob: VaultBlob, demoUser = DEMO_PLACEHOLDER): Promise<void> {
  const presign = await grantRequest<PresignResponse>("/vault/presign-put", demoUser, {
    method: "POST",
  });
  const response = await fetch(presign.url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(presign.headers || {}),
    },
    body: JSON.stringify(blob),
  });
  if (!response.ok) {
    throw new Error("Failed to upload encrypted vault to storage.");
  }
}

export async function downloadVaultBlob(demoUser = DEMO_PLACEHOLDER): Promise<VaultBlob> {
  const status = await fetchVaultStatus(demoUser);
  if (!status.exists) {
    throw new Error("No vault keystore found for this account.");
  }
  const presign = await grantRequest<PresignResponse>("/vault/presign-get", demoUser, {
    method: "POST",
  });
  const response = await fetch(presign.url, { method: "GET" });
  if (response.status === 404) {
    throw new Error("No vault keystore found for this account.");
  }
  if (!response.ok) {
    throw new Error("Failed to download encrypted vault from storage.");
  }
  const body: unknown = await response.json();
  if (!isVaultBlob(body)) {
    throw new Error("Downloaded vault blob is invalid.");
  }
  return body;
}
