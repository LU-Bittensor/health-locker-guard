/** Client document format v1: X25519/HKDF-SHA256 key wrapping + AES-256-GCM.
 * Content keys and X25519 private keys never leave the unlocked browser vault.
 */
import { x25519 } from "@noble/curves/ed25519.js";
import { privateKeyToAccount } from "viem/accounts";
import { verifyMessage, type Hex } from "viem";
import type { VaultSession } from "./vault-session";

export type Manifest = {
  version: 1;
  record_id: string;
  owner_id: string;
  owner_wallet: string;
  owner_public_key: string;
  mime: string;
  size: number;
  ciphertext_sha256: string;
};
export type KeyEnvelope = {
  recipient_id: string;
  recipient_public_key: string;
  wrapped_key: string;
  signature: Hex;
};
export type EncryptionInfo = { manifest: Manifest; envelope: KeyEnvelope };
export const bytes = (a: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(a);
export function b64(a: Uint8Array): string {
  let s = "";
  for (const n of a) s += String.fromCharCode(n);
  return btoa(s);
}
export const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const utf8 = (s: string) => new TextEncoder().encode(s);
function core(m: Manifest) {
  return [
    "medilink-document-v1",
    m.record_id,
    m.owner_id,
    m.owner_wallet.toLowerCase(),
    m.owner_public_key,
    m.mime,
    m.size,
  ];
}
function context(m: Manifest, recipient: string, publicKey: string) {
  return JSON.stringify([...core(m), m.ciphertext_sha256, recipient, publicKey]);
}
export function envelopeMessage(m: Manifest, e: Omit<KeyEnvelope, "signature">): string {
  return JSON.stringify([
    "medilink-document-envelope-v1",
    context(m, e.recipient_id, e.recipient_public_key),
    e.wrapped_key,
  ]);
}
async function aes(key: Uint8Array, data: Uint8Array, aad: string, decrypt = false) {
  const k = await crypto.subtle.importKey("raw", bytes(key), "AES-GCM", false, [
    decrypt ? "decrypt" : "encrypt",
  ]);
  const nonce = decrypt ? bytes(data.slice(0, 12)) : crypto.getRandomValues(new Uint8Array(12));
  if (decrypt && data.length < 28) throw new Error("Invalid encrypted document.");
  const options = { name: "AES-GCM", iv: nonce, additionalData: utf8(aad), tagLength: 128 };
  if (decrypt)
    return new Uint8Array(await crypto.subtle.decrypt(options, k, bytes(data.slice(12))));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(options, k, bytes(data)));
  const result = new Uint8Array(12 + encrypted.length);
  result.set(nonce);
  result.set(encrypted, 12);
  return result;
}
async function wrappingKey(privateKey: string, publicKey: string, info: string) {
  const shared = x25519.getSharedSecret(unb64(privateKey), unb64(publicKey));
  if (shared.every((n) => n === 0)) throw new Error("Invalid recipient encryption key.");
  try {
    const input = await crypto.subtle.importKey("raw", bytes(shared), "HKDF", false, [
      "deriveBits",
    ]);
    return new Uint8Array(
      await crypto.subtle.deriveBits(
        {
          name: "HKDF",
          hash: "SHA-256",
          salt: utf8("medilink-document-wrap-v1"),
          info: utf8(info),
        },
        input,
        256,
      ),
    );
  } finally {
    shared.fill(0);
  }
}
export async function digest(data: Uint8Array) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes(data))), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}
function validateVault(session: VaultSession) {
  const c = session.contents;
  if (
    b64(x25519.getPublicKey(unb64(c.x25519PrivateKeyB64))) !== c.x25519PublicKeyB64 ||
    privateKeyToAccount(c.evmPrivateKeyHex as Hex).address.toLowerCase() !==
      c.evmAddress.toLowerCase()
  )
    throw new Error("Vault public and private keys do not match.");
}
export async function identityFingerprint(user: string, wallet: string, publicKey: string) {
  return digest(utf8(JSON.stringify([user, wallet.toLowerCase(), publicKey])));
}
export async function wrapDocumentKey(
  key: Uint8Array,
  manifest: Manifest,
  session: VaultSession,
  recipientId: string,
  recipientPublic: string,
): Promise<KeyEnvelope> {
  validateVault(session);
  if (
    manifest.owner_id !== session.userId ||
    manifest.owner_public_key !== session.contents.x25519PublicKeyB64 ||
    manifest.owner_wallet.toLowerCase() !== session.contents.evmAddress.toLowerCase()
  )
    throw new Error("Only the document's original vault can share its key.");
  const info = context(manifest, recipientId, recipientPublic);
  const wrapping = await wrappingKey(session.contents.x25519PrivateKeyB64, recipientPublic, info);
  try {
    const envelope = {
      recipient_id: recipientId,
      recipient_public_key: recipientPublic,
      wrapped_key: b64(await aes(wrapping, key, info)),
    };
    const account = privateKeyToAccount(session.contents.evmPrivateKeyHex as Hex);
    return {
      ...envelope,
      signature: await account.signMessage({ message: envelopeMessage(manifest, envelope) }),
    };
  } finally {
    wrapping.fill(0);
  }
}
export async function unwrapDocumentKey(info: EncryptionInfo, session: VaultSession) {
  validateVault(session);
  const { manifest: m, envelope: e } = info;
  if (
    m.version !== 1 ||
    e.recipient_id !== session.userId ||
    e.recipient_public_key !== session.contents.x25519PublicKeyB64 ||
    !(await verifyMessage({
      address: m.owner_wallet as Hex,
      message: envelopeMessage(m, e),
      signature: e.signature,
    }))
  ) {
    throw new Error("Document key signature or recipient does not match this vault.");
  }
  if (
    m.owner_id === session.userId &&
    (m.owner_public_key !== session.contents.x25519PublicKeyB64 ||
      m.owner_wallet.toLowerCase() !== session.contents.evmAddress.toLowerCase())
  )
    throw new Error("This document belongs to a different vault key.");
  const ctx = context(m, e.recipient_id, e.recipient_public_key);
  const wrapping = await wrappingKey(session.contents.x25519PrivateKeyB64, m.owner_public_key, ctx);
  try {
    const key = await aes(wrapping, unb64(e.wrapped_key), ctx, true);
    if (key.length !== 32) throw new Error("Invalid document key.");
    return key;
  } finally {
    wrapping.fill(0);
  }
}
export async function encryptDocument(content: Uint8Array, mime: string, session: VaultSession) {
  if (!content.length || content.length > 10 * 1024 * 1024)
    throw new Error("Choose a document up to 10 MB.");
  const key = crypto.getRandomValues(new Uint8Array(32));
  const manifest: Manifest = {
    version: 1,
    record_id: crypto.randomUUID(),
    owner_id: session.userId,
    owner_wallet: session.contents.evmAddress,
    owner_public_key: session.contents.x25519PublicKeyB64,
    mime,
    size: content.length,
    ciphertext_sha256: "",
  };
  try {
    const ciphertext = await aes(key, content, JSON.stringify(core(manifest)));
    manifest.ciphertext_sha256 = await digest(ciphertext);
    const envelope = await wrapDocumentKey(
      key,
      manifest,
      session,
      session.userId,
      session.contents.x25519PublicKeyB64,
    );
    return { ciphertext, info: { manifest, envelope } };
  } finally {
    key.fill(0);
  }
}
export async function decryptDocument(
  ciphertext: Uint8Array,
  info: EncryptionInfo,
  session: VaultSession,
) {
  if ((await digest(ciphertext)) !== info.manifest.ciphertext_sha256)
    throw new Error("Encrypted document integrity check failed.");
  const key = await unwrapDocumentKey(info, session);
  try {
    const result = await aes(key, ciphertext, JSON.stringify(core(info.manifest)), true);
    if (result.length !== info.manifest.size) throw new Error("Document size does not match.");
    return result;
  } finally {
    key.fill(0);
  }
}

/** Explicit first-contact pinning. Compare fingerprint via a separate trusted channel.
 * A changed binding is never silently accepted. Pins are local to this browser.
 */
export async function confirmDocumentIdentity(
  viewer: string,
  user: string,
  wallet: string,
  publicKey: string,
) {
  const fingerprint = await identityFingerprint(user, wallet, publicKey);
  const pinKey = `medilink-document-identity-v1:${viewer}:${user}`;
  const saved = localStorage.getItem(pinKey);
  if (saved === fingerprint) return;
  if (saved)
    throw new Error(
      "This account's encryption identity changed. Verify it out of band before resetting its saved identity pin.",
    );
  if (
    !window.confirm(
      `Verify the encryption identity of account ${user} through a separate trusted channel.\nWallet: ${wallet}\nFingerprint: ${fingerprint}\n\nOnly continue if the fingerprint matches. Save this identity?`,
    )
  )
    throw new Error("Encryption identity was not confirmed.");
  localStorage.setItem(pinKey, fingerprint);
}
