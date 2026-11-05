import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type Address,
  keccak256,
  encodePacked,
  stringToBytes,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import { accessRegistryAbi } from "@/lib/registry-abi";
import { getVaultSession } from "@/lib/vault-session";
import { ensureGas } from "@/lib/faucet";
import { grantRequest } from "@/lib/grant-api";

const rpcUrl = import.meta.env["VITE_EVM_RPC_URL"] || "http://127.0.0.1:8545";
const chainId = Number(import.meta.env["VITE_EVM_CHAIN_ID"] || "31337");
const registryAddress = (import.meta.env["VITE_ACCESS_REGISTRY"] || "") as Address;

const localChain = {
  ...hardhat,
  id: chainId,
  rpcUrls: { default: { http: [rpcUrl] } },
} as const;

export async function resolveRegistryAddress(): Promise<Address> {
  if (chainId === 31337) {
    const result = await grantRequest<{ address: string; chain_id: number }>(
      "/registry/resolve",
      "",
      { method: "POST", body: "{}" },
    );
    if (result.chain_id !== chainId || !/^0x[0-9a-fA-F]{40}$/.test(result.address)) {
      throw new Error("The API returned an incompatible AccessRegistry configuration.");
    }
    return result.address as Address;
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(registryAddress)) {
    throw new Error("Set VITE_ACCESS_REGISTRY to the deployed AccessRegistry address.");
  }
  return registryAddress;
}

function requireVaultAccount() {
  const session = getVaultSession();
  if (!session?.contents.evmPrivateKeyHex) {
    throw new Error("Unlock your vault before signing AccessRegistry transactions.");
  }
  const key = session.contents.evmPrivateKeyHex.startsWith("0x")
    ? (session.contents.evmPrivateKeyHex as Hex)
    : (`0x${session.contents.evmPrivateKeyHex}` as Hex);
  return privateKeyToAccount(key);
}

function clients() {
  const account = requireVaultAccount();
  const publicClient = createPublicClient({ chain: localChain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({
    account,
    chain: localChain,
    transport: http(rpcUrl),
  });
  return { account, publicClient, walletClient };
}

/** Stable bytes32 resource id from project record id string. */
export function resourceIdFromRecord(recordId: string): Hex {
  return keccak256(stringToBytes(`medilink:record:${recordId}`));
}

export function dataHashFromCid(dataCid: string): Hex {
  return keccak256(stringToBytes(dataCid));
}

/**
 * Interim commitment until client-side X25519 DH is wired:
 * keccak256(ownerPub || granteeAddr || resourceId).
 */
export function interimCommitment(params: {
  ownerX25519PublicKeyB64: string;
  grantee: Address;
  resourceId: Hex;
}): Hex {
  return keccak256(
    encodePacked(
      ["string", "address", "bytes32"],
      [params.ownerX25519PublicKeyB64, params.grantee, params.resourceId],
    ),
  );
}

export function verifyResponse(commitment: Hex, nonce: Hex): Hex {
  return keccak256(encodePacked(["bytes32", "bytes32"], [commitment, nonce]));
}

async function withGas<T>(fn: () => Promise<T>): Promise<T> {
  await ensureGas();
  return fn();
}

export async function registerResource(params: {
  recordId: string;
  dataCid: string;
}): Promise<Hex> {
  const registry = await resolveRegistryAddress();
  const { walletClient, publicClient, account } = clients();
  const resourceId = resourceIdFromRecord(params.recordId);
  const dataHash = dataHashFromCid(params.dataCid);
  return withGas(async () => {
    const hash = await walletClient.writeContract({
      address: registry,
      abi: accessRegistryAbi,
      functionName: "registerResource",
      args: [resourceId, dataHash, params.dataCid],
      account,
      chain: localChain,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  });
}

export async function grantAccessOnChain(params: {
  recordId: string;
  grantee: Address;
  commitment: Hex;
}): Promise<Hex> {
  const registry = await resolveRegistryAddress();
  const { walletClient, publicClient, account } = clients();
  const resourceId = resourceIdFromRecord(params.recordId);
  return withGas(async () => {
    const hash = await walletClient.writeContract({
      address: registry,
      abi: accessRegistryAbi,
      functionName: "grantAccess",
      args: [resourceId, params.grantee, params.commitment],
      account,
      chain: localChain,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  });
}

export async function revokeAccessOnChain(params: {
  recordId: string;
  grantee: Address;
}): Promise<Hex> {
  const registry = await resolveRegistryAddress();
  const { walletClient, publicClient, account } = clients();
  const resourceId = resourceIdFromRecord(params.recordId);
  return withGas(async () => {
    const hash = await walletClient.writeContract({
      address: registry,
      abi: accessRegistryAbi,
      functionName: "revokeAccess",
      args: [resourceId, params.grantee],
      account,
      chain: localChain,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  });
}

export async function proveAccessOnChain(params: {
  recordId: string;
  commitment: Hex;
}): Promise<{ challengeTx: Hex; verifyTx: Hex; granted: boolean }> {
  const registry = await resolveRegistryAddress();
  const { walletClient, publicClient, account } = clients();
  const resourceId = resourceIdFromRecord(params.recordId);
  return withGas(async () => {
    const challengeTx = await walletClient.writeContract({
      address: registry,
      abi: accessRegistryAbi,
      functionName: "requestChallenge",
      args: [resourceId],
      account,
      chain: localChain,
    });
    const challengeReceipt = await publicClient.waitForTransactionReceipt({ hash: challengeTx });
    // Read ChallengeIssued nonce from logs is ideal; for MVP re-call isn't possible.
    // Decode first log data if present; otherwise derive via eth_call simulation is unavailable.
    // Fallback: parse event from receipt logs (topic0 = ChallengeIssued).
    const challengeIssuedTopic = keccak256(
      stringToBytes("ChallengeIssued(bytes32,address,bytes32,uint256)"),
    );
    let nonce: Hex | null = null;
    for (const log of challengeReceipt.logs) {
      if (log.topics[0]?.toLowerCase() === challengeIssuedTopic.toLowerCase() && log.data) {
        // data = nonce (32) + expiry (32)
        nonce = `0x${log.data.slice(2, 66)}` as Hex;
        break;
      }
    }
    if (!nonce) {
      throw new Error("Could not read challenge nonce from ChallengeIssued log.");
    }
    const response = verifyResponse(params.commitment, nonce);
    const verifyTx = await walletClient.writeContract({
      address: registry,
      abi: accessRegistryAbi,
      functionName: "verifyAccess",
      args: [resourceId, response],
      account,
      chain: localChain,
    });
    await publicClient.waitForTransactionReceipt({ hash: verifyTx });
    const granted = await publicClient.readContract({
      address: registry,
      abi: accessRegistryAbi,
      functionName: "hasGrant",
      args: [resourceId, account.address],
    });
    return { challengeTx, verifyTx, granted: Boolean(granted) };
  });
}

export function registryConfigured(): boolean {
  return chainId === 31337 || Boolean(registryAddress && registryAddress.startsWith("0x"));
}

export function vaultEvmAddress(): Address | null {
  const session = getVaultSession();
  return (session?.contents.evmAddress as Address) || null;
}

/** Encode a hex string without 0x for debugging. */
export function toBytes32Hex(value: string): Hex {
  return toHex(stringToBytes(value), { size: 32 });
}

export type SharedOnChainGrant = {
  resourceId: Hex;
  recordId: string | null;
  dataCid: string;
  dataHash: Hex;
  owner: Address;
  grantee: Address;
  active: boolean;
  grantTxHash: Hex | null;
  blockNumber: bigint | null;
};

const RECORD_CID_PREFIX = "medilink:record:";

export function recordIdFromDataCid(dataCid: string): string | null {
  if (!dataCid.startsWith(RECORD_CID_PREFIX)) return null;
  const id = dataCid.slice(RECORD_CID_PREFIX.length).trim();
  return id || null;
}

function publicClientOnly() {
  return createPublicClient({ chain: localChain, transport: http(rpcUrl) });
}

/**
 * MVP: discover records shared with this vault by scanning AccessGrantSet logs
 * for `grantee`, then confirming live state with hasGrant + resources().
 */
export async function listSharedGrantsForVault(
  grantee?: Address | null,
): Promise<SharedOnChainGrant[]> {
  if (!registryConfigured()) return [];
  const registry = await resolveRegistryAddress();
  const address = (grantee || vaultEvmAddress()) as Address | null;
  if (!address) {
    throw new Error("Unlock your vault to load on-chain shares.");
  }

  const publicClient = publicClientOnly();
  const grantLogs = await publicClient.getContractEvents({
    address: registry,
    abi: accessRegistryAbi,
    eventName: "AccessGrantSet",
    args: { grantee: address },
    fromBlock: 0n,
    toBlock: "latest",
  });

  // Latest grant log per resource wins for tx/block metadata.
  const latestByResource = new Map<
    string,
    { resourceId: Hex; dataHash: Hex; txHash: Hex | null; blockNumber: bigint | null }
  >();
  for (const log of grantLogs) {
    const resourceId = log.args.resourceId as Hex | undefined;
    if (!resourceId) continue;
    latestByResource.set(resourceId.toLowerCase(), {
      resourceId,
      dataHash: (log.args.dataHash as Hex) || ("0x" as Hex),
      txHash: (log.transactionHash as Hex) || null,
      blockNumber: log.blockNumber ?? null,
    });
  }

  const shared: SharedOnChainGrant[] = [];
  for (const entry of latestByResource.values()) {
    const active = Boolean(
      await publicClient.readContract({
        address: registry,
        abi: accessRegistryAbi,
        functionName: "hasGrant",
        args: [entry.resourceId, address],
      }),
    );
    if (!active) continue;

    const resource = await publicClient.readContract({
      address: registry,
      abi: accessRegistryAbi,
      functionName: "resources",
      args: [entry.resourceId],
    });
    const [owner, onChainHash, dataCid, exists] = resource as [Address, Hex, string, boolean];
    if (!exists) continue;

    shared.push({
      resourceId: entry.resourceId,
      recordId: recordIdFromDataCid(dataCid),
      dataCid,
      dataHash: onChainHash || entry.dataHash,
      owner,
      grantee: address,
      active: true,
      grantTxHash: entry.txHash,
      blockNumber: entry.blockNumber,
    });
  }

  shared.sort((a, b) => {
    const ba = a.blockNumber ?? 0n;
    const bb = b.blockNumber ?? 0n;
    if (ba === bb) return a.resourceId.localeCompare(b.resourceId);
    return ba < bb ? 1 : -1;
  });
  return shared;
}
