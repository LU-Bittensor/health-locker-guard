import { describe, expect, it } from "vitest";

import { decryptVault, encryptVault, generateVaultContents, isVaultBlob } from "@/lib/vault-crypto";

describe("vault-crypto", () => {
  it("round-trips encrypt and decrypt for the same user and password", async () => {
    const userId = "11111111-2222-3333-4444-555555555555";
    const password = "correct-horse-battery-staple";
    const contents = generateVaultContents();
    const blob = await encryptVault(password, userId, contents);

    expect(isVaultBlob(blob)).toBe(true);
    expect(blob.userId).toBe(userId);

    const opened = await decryptVault(password, userId, blob);
    expect(opened.evmAddress).toBe(contents.evmAddress);
    expect(opened.evmPrivateKeyHex).toBe(contents.evmPrivateKeyHex);
    expect(opened.x25519PublicKeyB64).toBe(contents.x25519PublicKeyB64);
    expect(opened.x25519PrivateKeyB64).toBe(contents.x25519PrivateKeyB64);
    expect(opened.recoveryMnemonic).toBe(contents.recoveryMnemonic);
  });

  it("rejects the wrong password", async () => {
    const userId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const contents = generateVaultContents();
    const blob = await encryptVault("right-password", userId, contents);

    await expect(decryptVault("wrong-password", userId, blob)).rejects.toThrow(
      /Wrong password or corrupt vault/,
    );
  });

  it("rejects a vault bound to a different userId", async () => {
    const contents = generateVaultContents();
    const blob = await encryptVault("password", "user-a", contents);
    await expect(decryptVault("password", "user-b", blob)).rejects.toThrow(
      /does not belong/,
    );
  });
});
