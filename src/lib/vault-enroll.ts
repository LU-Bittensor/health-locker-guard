import { grantRequest } from "@/lib/grant-api";
import { ensureGas } from "@/lib/faucet";
import {
  getUnlockedEvmAddress,
  getUnlockedX25519PublicKeyB64,
  getVaultSession,
} from "@/lib/vault-session";

export type EnrolledWallet = {
  id: string;
  name: string;
  wallet: string;
  funded?: boolean | null;
};

/** Publish vault public keys to the API and top up gas when a faucet is configured. */
export async function enrollUnlockedVault(demoUser = "patient"): Promise<EnrolledWallet> {
  const session = getVaultSession();
  const evmAddress = getUnlockedEvmAddress();
  const x25519PublicKeyB64 = getUnlockedX25519PublicKeyB64();
  if (!session || !evmAddress) {
    throw new Error("Unlock your vault before enrolling the EVM wallet.");
  }

  const enrolled = await grantRequest<EnrolledWallet>("/enroll", demoUser, {
    method: "POST",
    body: JSON.stringify({
      evmAddress,
      x25519PublicKeyB64,
    }),
  });

  try {
    await ensureGas(demoUser);
  } catch {
    // Enroll succeeded; faucet may be offline on local demos without FAUCET_ADDRESS.
  }

  return enrolled;
}
