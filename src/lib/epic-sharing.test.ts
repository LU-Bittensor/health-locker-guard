import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { x25519 } from "@noble/curves/ed25519.js";
import { privateKeyToAccount } from "viem/accounts";
import {
  b64,
  unb64,
  encryptDocument,
  decryptDocument,
  unwrapDocumentKey,
  wrapDocumentKey,
  type EncryptionInfo,
  type KeyEnvelope,
} from "./document-crypto";
import { sharingMode } from "./sharing-mode";
import { epicPreview } from "./epic-preview";
import type { VaultSession } from "./vault-session";

// Public deterministic test keys only. Never use these vaults for real accounts.
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
const owner = vault("c8f0280b-5237-4391-9cfe-e977fabfca92", 1);
const recipient = vault("84816262-e3d1-465b-9945-fb9457fe1fb9", 2);
const outsider = vault("94816262-e3d1-465b-9945-fb9457fe1fb9", 3);
const snapshot = {
  format: "medilink-epic-snapshot-v1",
  imported_at: 1794000000,
  records: [
    { id: "synthetic-pulse", category: "vital-signs", name: "Pulse", value: "72", unit: "/min" },
  ],
};
type Fixture = { ciphertext: string; info: EncryptionInfo; recipientEnvelope: KeyEnvelope };

describe("encrypted Epic sharing across two vaults", () => {
  it("shares the exact snapshot with one recipient and uses wallet routing when configured", async () => {
    const plain = new TextEncoder().encode(JSON.stringify(snapshot));
    const { ciphertext, info } = await encryptDocument(
      plain,
      "text/plain",
      owner,
      "db40a157-2a86-4312-b9e7-cce9e1bb9ad2",
    );
    const key = await unwrapDocumentKey(info, owner);
    const recipientEnvelope = await wrapDocumentKey(
      key,
      info.manifest,
      owner,
      recipient.userId,
      recipient.contents.x25519PublicKeyB64,
    );
    key.fill(0);
    const delivered = await decryptDocument(
      ciphertext,
      { ...info, envelope: recipientEnvelope },
      recipient,
    );
    expect(delivered).toEqual(plain);
    expect(epicPreview(new TextDecoder().decode(delivered))).toContain("72 /min");
    await expect(decryptDocument(ciphertext, info, recipient)).rejects.toThrow();
    await expect(
      decryptDocument(ciphertext, { ...info, envelope: recipientEnvelope }, outsider),
    ).rejects.toThrow();
    expect(sharingMode([{ id: info.manifest.record_id }], true)).toBe("wallet");
    expect(sharingMode([{ id: info.manifest.record_id }], false)).toBe("api");
    // Regenerate the Python interoperability fixture only when explicitly requested.
    if (process.env["EPIC_SHARING_FIXTURE"])
      writeFileSync(
        process.env["EPIC_SHARING_FIXTURE"],
        JSON.stringify({ ciphertext: b64(ciphertext), info, recipientEnvelope }),
      );
  });
  it("decrypts the same synthetic fixture consumed by the API sharing tests", async () => {
    const file =
      process.env["EPIC_SHARING_FIXTURE"] ||
      new URL("./fixtures/epic-shared-document.json", import.meta.url);
    const fixture: Fixture = JSON.parse(readFileSync(file, "utf8"));
    const content = await decryptDocument(
      unb64(fixture.ciphertext),
      { ...fixture.info, envelope: fixture.recipientEnvelope },
      recipient,
    );
    expect(JSON.parse(new TextDecoder().decode(content))).toEqual(snapshot);
  });
});
