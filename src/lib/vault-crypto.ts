import { x25519 } from "@noble/curves/ed25519.js";
import { hexToBytes } from "@noble/hashes/utils.js";
import { generateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { argon2id } from "hash-wasm";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export const VAULT_VERSION = 1 as const;

const KDF_MEMORY = 65536;
const KDF_ITERATIONS = 3;
const KDF_PARALLELISM = 1;
const KEY_LENGTH = 32;
const NONCE_LENGTH = 12;

export type VaultContents = {
  evmPrivateKeyHex: string;
  evmAddress: string;
  x25519PrivateKeyB64: string;
  x25519PublicKeyB64: string;
  recoveryMnemonic: string;
};

export type VaultBlob = {
  version: typeof VAULT_VERSION;
  userId: string;
  kdf: {
    name: "argon2id";
    salt_b64: string;
    memory: number;
    iterations: number;
    parallelism: number;
  };
  cipher: {
    name: "aes-256-gcm";
    nonce_b64: string;
    ciphertext_b64: string;
  };
};

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/** Copy into a fresh ArrayBuffer-backed view for Web Crypto BufferSource typing. */
function asBufferSource(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

function aadBytes(userId: string, version: number): Uint8Array<ArrayBuffer> {
  return asBufferSource(new TextEncoder().encode(`${userId}:${version}`));
}

async function deriveVaultKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const hexKey = await argon2id({
    password,
    salt,
    parallelism: KDF_PARALLELISM,
    iterations: KDF_ITERATIONS,
    memorySize: KDF_MEMORY,
    hashLength: KEY_LENGTH,
    outputType: "hex",
  });
  return hexToBytes(hexKey);
}

export function generateVaultContents(): VaultContents {
  const evmPrivateKeyHex = generatePrivateKey();
  const account = privateKeyToAccount(evmPrivateKeyHex);
  const x25519Keys = x25519.keygen();
  return {
    evmPrivateKeyHex,
    evmAddress: account.address,
    x25519PrivateKeyB64: toBase64(x25519Keys.secretKey),
    x25519PublicKeyB64: toBase64(x25519Keys.publicKey),
    recoveryMnemonic: generateMnemonic(wordlist, 128),
  };
}

export async function encryptVault(
  password: string,
  userId: string,
  contents: VaultContents,
): Promise<VaultBlob> {
  if (!userId) throw new Error("userId is required to encrypt the vault.");
  if (!password) throw new Error("password is required to encrypt the vault.");

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));
  const keyBytes = asBufferSource(await deriveVaultKey(password, salt));
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const plaintext = asBufferSource(new TextEncoder().encode(JSON.stringify(contents)));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, additionalData: aadBytes(userId, VAULT_VERSION) },
      cryptoKey,
      plaintext,
    ),
  );

  return {
    version: VAULT_VERSION,
    userId,
    kdf: {
      name: "argon2id",
      salt_b64: toBase64(salt),
      memory: KDF_MEMORY,
      iterations: KDF_ITERATIONS,
      parallelism: KDF_PARALLELISM,
    },
    cipher: {
      name: "aes-256-gcm",
      nonce_b64: toBase64(nonce),
      ciphertext_b64: toBase64(sealed),
    },
  };
}

export async function decryptVault(
  password: string,
  userId: string,
  blob: VaultBlob,
): Promise<VaultContents> {
  if (!blob || blob.version !== VAULT_VERSION) {
    throw new Error("Unsupported or missing vault blob version.");
  }
  if (blob.userId !== userId) {
    throw new Error("Vault blob does not belong to this account.");
  }
  if (blob.kdf?.name !== "argon2id" || blob.cipher?.name !== "aes-256-gcm") {
    throw new Error("Unsupported vault crypto parameters.");
  }

  try {
    const salt = asBufferSource(fromBase64(blob.kdf.salt_b64));
    const nonce = asBufferSource(fromBase64(blob.cipher.nonce_b64));
    const ciphertext = asBufferSource(fromBase64(blob.cipher.ciphertext_b64));
    const keyBytes = asBufferSource(await deriveVaultKey(password, salt));
    const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
    const opened = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonce, additionalData: aadBytes(userId, blob.version) },
        cryptoKey,
        ciphertext,
      ),
    );
    const parsed = JSON.parse(new TextDecoder().decode(opened)) as VaultContents;
    if (
      !parsed?.evmPrivateKeyHex ||
      !parsed?.evmAddress ||
      !parsed?.x25519PrivateKeyB64 ||
      !parsed?.x25519PublicKeyB64 ||
      !parsed?.recoveryMnemonic
    ) {
      throw new Error("Vault plaintext is incomplete.");
    }
    return parsed;
  } catch {
    throw new Error("Wrong password or corrupt vault.");
  }
}

export function isVaultBlob(value: unknown): value is VaultBlob {
  if (!value || typeof value !== "object") return false;
  const candidate = value as VaultBlob;
  return (
    candidate.version === VAULT_VERSION &&
    typeof candidate.userId === "string" &&
    typeof candidate.kdf?.salt_b64 === "string" &&
    typeof candidate.cipher?.ciphertext_b64 === "string"
  );
}
