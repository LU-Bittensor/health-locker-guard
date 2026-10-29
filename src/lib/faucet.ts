import { grantRequest, localGrantDemo } from "@/lib/grant-api";

export type FaucetEnsureResult = {
  address: string;
  balance: number;
  dripped: boolean;
  txHash: string | null;
};

export type FaucetStatus = {
  address: string;
  dripAmount: number;
  minBalance: number;
  cooldown: number;
  operator: string;
  balance: number;
  chainId: number;
  rpcUrl: string;
};

/** Ask the MediLink API to drip gas to the enrolled vault address if low. */
export async function ensureGas(demoUser = "patient"): Promise<FaucetEnsureResult | null> {
  try {
    return await grantRequest<FaucetEnsureResult>("/faucet/ensure", demoUser, { method: "POST" });
  } catch (error) {
    // Faucet may be unset in pure off-chain demos.
    if (localGrantDemo) return null;
    throw error;
  }
}

export async function fetchFaucetStatus(demoUser = "patient"): Promise<FaucetStatus> {
  return grantRequest<FaucetStatus>("/faucet/status", demoUser);
}
