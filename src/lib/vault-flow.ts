import {
  decryptVault,
  encryptVault,
  generateVaultContents,
  type VaultContents,
} from "@/lib/vault-crypto";
import { setVaultSession } from "@/lib/vault-session";
import { downloadVaultBlob, fetchVaultStatus, uploadVaultBlob } from "@/lib/vault-storage";

export type UnlockResult =
  | { kind: "unlocked"; contents: VaultContents }
  | { kind: "created"; contents: VaultContents; recoveryMnemonic: string };

/**
 * After Supabase auth: unlock existing Hippius/local vault or create one.
 * Password is used only client-side for Argon2id; never sent to grant_api.
 */
export async function unlockOrCreateVault(params: {
  userId: string;
  password: string;
  demoUser?: string;
}): Promise<UnlockResult> {
  const { userId, password, demoUser } = params;
  const status = await fetchVaultStatus(demoUser);

  if (status.exists) {
    const blob = await downloadVaultBlob(demoUser);
    const contents = await decryptVault(password, userId, blob);
    setVaultSession(userId, contents);
    return { kind: "unlocked", contents };
  }

  const contents = generateVaultContents();
  const blob = await encryptVault(password, userId, contents);
  await uploadVaultBlob(blob, demoUser);
  setVaultSession(userId, contents);
  return {
    kind: "created",
    contents,
    recoveryMnemonic: contents.recoveryMnemonic,
  };
}
