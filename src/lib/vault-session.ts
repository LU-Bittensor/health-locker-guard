import type { VaultContents } from "@/lib/vault-crypto";

export type VaultSession = {
  userId: string;
  unlockedAt: number;
  contents: VaultContents;
};

let session: VaultSession | null = null;

export function setVaultSession(userId: string, contents: VaultContents): VaultSession {
  session = { userId, contents, unlockedAt: Date.now() };
  return session;
}

export function getVaultSession(): VaultSession | null {
  return session;
}

export function isVaultUnlocked(userId?: string): boolean {
  if (!session) return false;
  if (userId && session.userId !== userId) return false;
  return true;
}

/** Wipe private material from memory. Call on sign-out. */
export function clearVaultSession(): void {
  session = null;
}

export function getUnlockedEvmAddress(): string | null {
  return session?.contents.evmAddress ?? null;
}

export function getUnlockedX25519PublicKeyB64(): string | null {
  return session?.contents.x25519PublicKeyB64 ?? null;
}
