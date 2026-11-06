import { getVaultSession } from "@/lib/vault-session";
import {
  encryptDocument,
  decryptDocument,
  unwrapDocumentKey,
  wrapDocumentKey,
  confirmDocumentIdentity,
  bytes,
  type EncryptionInfo,
} from "@/lib/document-crypto";
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
  client_encrypted?: boolean;
  id: string;
  name: string;
  kind: string;
  owner_id?: string;
  tags?: string[];
  mime_type?: string | null;
  size?: number | null;
  has_document?: boolean;
  created_at?: string;
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
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || "Request failed. Please try again.");
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

async function documentVault() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = getVaultSession();
  if (!session || session.userId !== data.session?.user.id)
    throw new Error("Unlock the vault for the signed-in account to encrypt or open documents.");
  return session;
}

function documentMime(file: File, content: Uint8Array): string {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pdf" && new TextDecoder().decode(content.slice(0, 5)) === "%PDF-")
    return "application/pdf";
  if (extension === "png" && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => content[i] === v))
    return "image/png";
  if (
    ["jpg", "jpeg"].includes(extension || "") &&
    content[0] === 255 &&
    content[1] === 216 &&
    content[2] === 255
  )
    return "image/jpeg";
  if (extension === "txt" && !content.includes(0)) {
    new TextDecoder("utf-8", { fatal: true }).decode(content);
    return "text/plain";
  }
  throw new Error("Choose a PDF, PNG, JPEG or UTF-8 text file matching its extension.");
}

export async function uploadDocument(
  file: File,
  tags: string,
  demoUser: string,
  kind?: string,
  recordId?: string,
  expectedUser?: string,
) {
  const body = new FormData();
  if (localGrantDemo) {
    body.append("file", file);
  } else {
    const session = await documentVault();
    if (expectedUser && session.userId !== expectedUser)
      throw new Error("Account changed during import.");
    if (!file.size || file.size > 10 * 1024 * 1024)
      throw new Error("Choose a non-empty document up to 10 MB.");
    const { enrollUnlockedVault } = await import("@/lib/vault-enroll");
    await enrollUnlockedVault(demoUser);
    const original = new Uint8Array(await file.arrayBuffer());
    const mime = documentMime(file, original);
    const encrypted = await encryptDocument(original, mime, session, recordId);
    original.fill(0);
    body.append(
      "file",
      new Blob([bytes(encrypted.ciphertext)], { type: "application/octet-stream" }),
      file.name,
    );
    body.append("client_info", JSON.stringify(encrypted.info));
  }
  body.append("tags", tags);
  if (kind?.trim()) body.append("kind", kind.trim());
  return grantRequest<GrantRecord>("/records", demoUser, { method: "POST", body });
}

export async function shareDocumentKey(recordId: string, recipient: GrantUser, demoUser: string) {
  const info = await grantRequest<EncryptionInfo & { client_encrypted: boolean }>(
    `/records/${encodeURIComponent(recordId)}/encryption`,
    demoUser,
  );
  if (!info.client_encrypted) return; // Existing files retain their legacy access path.
  const session = await documentVault();
  if (info.manifest.record_id !== recordId || info.manifest.owner_id !== session.userId)
    throw new Error("Document owner mismatch.");
  if (!recipient.x25519PublicKeyB64)
    throw new Error("Recipient must unlock and enroll their vault.");
  await confirmDocumentIdentity(
    session.userId,
    recipient.id,
    recipient.wallet,
    recipient.x25519PublicKeyB64,
  );
  const key = await unwrapDocumentKey(info, session);
  try {
    const envelope = await wrapDocumentKey(
      key,
      info.manifest,
      session,
      recipient.id,
      recipient.x25519PublicKeyB64,
    );
    await grantRequest(`/records/${encodeURIComponent(recordId)}/encryption`, demoUser, {
      method: "POST",
      body: JSON.stringify({ recipient_id: recipient.id, envelope }),
    });
  } finally {
    key.fill(0);
  }
}

export async function viewDocument(id: string, demoUser: string, signal: AbortSignal) {
  const info = await grantRequest<EncryptionInfo & { client_encrypted: boolean }>(
    `/records/${encodeURIComponent(id)}/encryption`,
    demoUser,
    { signal },
  );
  const session = info.client_encrypted ? await documentVault() : null;
  if (session) {
    if (info.manifest.record_id !== id) throw new Error("Document identity mismatch.");
    if (info.manifest.owner_id !== session.userId) {
      await confirmDocumentIdentity(
        session.userId,
        info.manifest.owner_id,
        info.manifest.owner_wallet,
        info.manifest.owner_public_key,
      );
    }
  }
  const response = await authenticatedRequest(
    `/records/${encodeURIComponent(id)}/document`,
    demoUser,
    { method: "POST", signal },
  );
  if (!session) return response.blob();
  const original = await decryptDocument(
    new Uint8Array(await response.arrayBuffer()),
    info,
    session,
  );
  if (getVaultSession() !== session)
    throw new Error("Vault was locked while opening the document.");
  return new Blob([bytes(original)], { type: info.manifest.mime });
}

/** List documents owned by the signed-in user (grant API → Supabase records). */
export async function listOwnedRecords(demoUser = "patient"): Promise<GrantRecord[]> {
  return grantRequest<GrantRecord[]>("/records", demoUser);
}

/** Metadata for a record the caller owns or is authorized to view (API or on-chain grant). */
export async function fetchRecordMetadata(
  recordId: string,
  demoUser = "patient",
): Promise<GrantRecord> {
  return grantRequest<GrantRecord>(`/records/${encodeURIComponent(recordId)}`, demoUser);
}

/** Encrypt a new document in the browser and upload ciphertext through the API. */
export async function uploadOwnedRecord(
  input: { file: File; tags?: string; kind?: string },
  demoUser = "patient",
): Promise<GrantRecord> {
  return uploadDocument(input.file, input.tags?.trim() || "", demoUser, input.kind);
}
