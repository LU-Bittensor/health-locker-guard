/** Minimal AccessRegistry ABI for vault-signed writes. */
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
] as const;
