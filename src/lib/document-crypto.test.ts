import { writeFileSync } from "node:fs";
import { describe, it, expect, vi, afterEach } from "vitest";
import { x25519 } from "@noble/curves/ed25519.js";
import { privateKeyToAccount } from "viem/accounts";
import {
  b64,
  encryptDocument,
  decryptDocument,
  unwrapDocumentKey,
  wrapDocumentKey,
  digest,
  confirmDocumentIdentity,
} from "./document-crypto";
import type { VaultSession } from "./vault-session";
function vault(userId: string, n: number): VaultSession {
  const key = new Uint8Array(32).fill(n);
  const evmPrivateKeyHex = `0x${n.toString(16).padStart(2, "0").repeat(32)}` as const;
  return {
    userId,
    unlockedAt: 0,
    contents: {
      evmPrivateKeyHex,
      evmAddress: privateKeyToAccount(evmPrivateKeyHex).address,
      x25519PrivateKeyB64: b64(key),
      x25519PublicKeyB64: b64(x25519.getPublicKey(key)),
      recoveryMnemonic: "",
    },
  };
}
const alice = vault("c8f0280b-5237-4391-9cfe-e977fabfca92", 1),
  bob = vault("bob", 2),
  eve = vault("eve", 3);
const plain = new TextEncoder().encode("private medical record");
describe("client document encryption", () => {
  it("roundtrips for owner and DH recipient, but not an unrelated vault", async () => {
    const { ciphertext, info } = await encryptDocument(plain, "text/plain", alice);
    expect(ciphertext.length).toBe(plain.length + 28);
    if (process.env["DOCUMENT_CRYPTO_FIXTURE"])
      writeFileSync(
        process.env["DOCUMENT_CRYPTO_FIXTURE"],
        JSON.stringify({ ciphertext: b64(ciphertext), info }),
      );
    expect(await decryptDocument(ciphertext, info, alice)).toEqual(plain);
    const key = await unwrapDocumentKey(info, alice);
    const envelope = await wrapDocumentKey(
      key,
      info.manifest,
      alice,
      bob.userId,
      bob.contents.x25519PublicKeyB64,
    );
    key.fill(0);
    expect(await decryptDocument(ciphertext, { ...info, envelope }, bob)).toEqual(plain);
    await expect(decryptDocument(ciphertext, { ...info, envelope }, eve)).rejects.toThrow();
  });
  it("rejects ciphertext tampering even if the transport hash is changed", async () => {
    const { ciphertext, info } = await encryptDocument(plain, "text/plain", alice);
    ciphertext[15] = ciphertext[15]! ^ 1;
    await expect(decryptDocument(ciphertext, info, alice)).rejects.toThrow();
    info.manifest.ciphertext_sha256 = await digest(ciphertext);
    await expect(decryptDocument(ciphertext, info, alice)).rejects.toThrow();
  });
  it("binds owner, document id, MIME and recipient into the signed envelope", async () => {
    const { ciphertext, info } = await encryptDocument(plain, "text/plain", alice);
    for (const field of ["record_id", "owner_id", "mime"] as const) {
      const changed = structuredClone(info);
      changed.manifest[field] += "changed";
      await expect(decryptDocument(ciphertext, changed, alice)).rejects.toThrow();
    }
    const changed = structuredClone(info);
    changed.envelope.recipient_id = "bob";
    await expect(decryptDocument(ciphertext, changed, bob)).rejects.toThrow();
  });
  it("uses fresh ciphertext and rejects invalid DH keys and mismatched vaults", async () => {
    const a = await encryptDocument(plain, "text/plain", alice);
    const b = await encryptDocument(plain, "text/plain", alice);
    expect(a.ciphertext).not.toEqual(b.ciphertext);
    const key = await unwrapDocumentKey(a.info, alice);
    await expect(
      wrapDocumentKey(key, a.info.manifest, alice, "bob", b64(new Uint8Array(32))),
    ).rejects.toThrow();
    key.fill(0);
    const broken = structuredClone(alice);
    broken.contents.x25519PublicKeyB64 = bob.contents.x25519PublicKeyB64;
    await expect(encryptDocument(plain, "text/plain", broken)).rejects.toThrow();
  });
});

describe("identity pinning", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("requires confirmation and blocks changed keys", async () => {
    const saved = new Map<string, string>();
    const confirm = vi.fn(() => false);
    vi.stubGlobal("window", { confirm });
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => saved.get(k),
      setItem: (k: string, v: string) => saved.set(k, v),
    });
    const args = [
      alice.userId,
      bob.userId,
      bob.contents.evmAddress,
      bob.contents.x25519PublicKeyB64,
    ] as const;
    await expect(confirmDocumentIdentity(...args)).rejects.toThrow("not confirmed");
    expect(saved.size).toBe(0);
    confirm.mockReturnValue(true);
    await confirmDocumentIdentity(...args);
    await confirmDocumentIdentity(...args);
    expect(confirm).toHaveBeenCalledTimes(2);
    await expect(
      confirmDocumentIdentity(
        alice.userId,
        bob.userId,
        bob.contents.evmAddress,
        eve.contents.x25519PublicKeyB64,
      ),
    ).rejects.toThrow("changed");
  });
});
