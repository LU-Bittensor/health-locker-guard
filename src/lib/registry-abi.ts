/** Minimal AccessRegistry ABI for vault-signed writes + grant discovery. */
export const accessRegistryAbi = [
  {
    type: "function",
    name: "registerResource",
    stateMutability: "nonpayable",
    inputs: [
      { name: "resourceId", type: "bytes32" },
      { name: "dataHash", type: "bytes32" },
      { name: "dataCid", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "grantAccess",
    stateMutability: "nonpayable",
    inputs: [
      { name: "resourceId", type: "bytes32" },
      { name: "grantee", type: "address" },
      { name: "commitment", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revokeAccess",
    stateMutability: "nonpayable",
    inputs: [
      { name: "resourceId", type: "bytes32" },
      { name: "grantee", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "requestChallenge",
    stateMutability: "nonpayable",
    inputs: [{ name: "resourceId", type: "bytes32" }],
    outputs: [{ name: "nonce", type: "bytes32" }],
  },
  {
    type: "function",
    name: "verifyAccess",
    stateMutability: "nonpayable",
    inputs: [
      { name: "resourceId", type: "bytes32" },
      { name: "response", type: "bytes32" },
    ],
    outputs: [{ name: "granted", type: "bool" }],
  },
  {
    type: "function",
    name: "hasGrant",
    stateMutability: "view",
    inputs: [
      { name: "resourceId", type: "bytes32" },
      { name: "grantee", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "resources",
    stateMutability: "view",
    inputs: [{ name: "resourceId", type: "bytes32" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "dataHash", type: "bytes32" },
      { name: "dataCid", type: "string" },
      { name: "exists", type: "bool" },
    ],
  },
  {
    type: "event",
    name: "AccessGrantSet",
    inputs: [
      { name: "resourceId", type: "bytes32", indexed: true },
      { name: "grantee", type: "address", indexed: true },
      { name: "dataHash", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AccessRevoked",
    inputs: [
      { name: "resourceId", type: "bytes32", indexed: true },
      { name: "grantee", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "ResourceRegistered",
    inputs: [
      { name: "resourceId", type: "bytes32", indexed: false },
      { name: "owner", type: "address", indexed: false },
      { name: "dataHash", type: "bytes32", indexed: false },
      { name: "dataCid", type: "string", indexed: false },
    ],
  },
] as const;
