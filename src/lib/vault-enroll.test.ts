import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateVaultContents } from "@/lib/vault-crypto";
import { clearVaultSession, setVaultSession } from "@/lib/vault-session";
import { enrollUnlockedVault } from "@/lib/vault-enroll";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  getSession: vi.fn(),
  ensureGas: vi.fn(),
}));
vi.mock("@/lib/grant-api", () => ({ grantRequest: mocks.request }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: mocks.getSession } },
}));
vi.mock("@/lib/faucet", () => ({ ensureGas: mocks.ensureGas }));

describe("vault enrollment during account switching", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearVaultSession();
  });
  afterEach(clearVaultSession);

  it("rejects an old account's unlocked keys before contacting enrollment", async () => {
    setVaultSession("owner", generateVaultContents());
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "recipient" } } } });
    await expect(enrollUnlockedVault()).rejects.toThrow(/signed-in account/);
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.ensureGas).not.toHaveBeenCalled();
  });

  it("rejects a signed-out session even if keys remain in memory", async () => {
    setVaultSession("owner", generateVaultContents());
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    await expect(enrollUnlockedVault()).rejects.toThrow(/signed-in account/);
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("enrolls only the current account's public keys, with the faucet optional", async () => {
    const contents = generateVaultContents();
    setVaultSession("owner", contents);
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "owner" } } } });
    mocks.request.mockResolvedValue({
      id: "owner",
      name: "Test owner",
      wallet: contents.evmAddress,
    });
    mocks.ensureGas.mockRejectedValue(new Error("Faucet is not configured"));
    const result = await enrollUnlockedVault();
    expect(result.wallet).toBe(contents.evmAddress);
    expect(mocks.request).toHaveBeenCalledWith("/enroll", "patient", {
      method: "POST",
      body: JSON.stringify({
        evmAddress: contents.evmAddress,
        x25519PublicKeyB64: contents.x25519PublicKeyB64,
      }),
    });
    expect(mocks.ensureGas).toHaveBeenCalledOnce();
  });
});
