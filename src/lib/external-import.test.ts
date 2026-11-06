import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { generateVaultContents } from "./vault-crypto";
import { clearVaultSession, setVaultSession } from "./vault-session";
import { saveEpicImport, snapshotPage } from "./external-import";
const mocks = vi.hoisted(() => ({ request: vi.fn(), upload: vi.fn() }));
vi.mock("./grant-api", () => ({
  grantRequest: mocks.request,
  uploadDocument: mocks.upload,
  viewDocument: vi.fn(),
  localGrantDemo: false,
}));
vi.mock("./vault-enroll", () => ({ enrollUnlockedVault: vi.fn() }));
const job = "10000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.resetAllMocks();
  setVaultSession("owner", generateVaultContents());
});
afterEach(clearVaultSession);
describe("Epic browser handoff", () => {
  it("uploads the complete snapshot before acknowledging completion and deduplicates concurrent saves", async () => {
    const snapshot = {
      format: "medilink-epic-snapshot-v1",
      bundle: { entry: [] },
      normalized: {},
      records: [],
    };
    mocks.request
      .mockResolvedValueOnce({ stored: false, snapshot })
      .mockResolvedValueOnce({ status: "completed" });
    mocks.upload.mockImplementation(
      async (file: File, _tags: string, _demo: string, kind: string, id: string, owner: string) => {
        expect(JSON.parse(await file.text())).toEqual(snapshot);
        expect([kind, id, owner]).toEqual(["Epic import", job, "owner"]);
        expect(mocks.request).toHaveBeenCalledTimes(1);
      },
    );
    const first = saveEpicImport(job),
      second = saveEpicImport(job);
    expect(first).toBe(second);
    expect((await first).status).toBe("completed");
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.request.mock.calls[1]?.[0]).toContain("/complete");
  });
  it("never reports completion after an upload failure", async () => {
    mocks.request.mockResolvedValue({ stored: false, snapshot: { records: [] } });
    mocks.upload.mockRejectedValue(new Error("storage unavailable"));
    await expect(saveEpicImport(job)).rejects.toThrow("storage unavailable");
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it("recovers an already published upload without encrypting a duplicate", async () => {
    mocks.request
      .mockResolvedValueOnce({ stored: true })
      .mockResolvedValueOnce({ status: "completed" });
    await saveEpicImport(job);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.request.mock.calls[1]?.[0]).toContain("/complete");
  });
  it("rejects locked vaults and account changes during handoff", async () => {
    clearVaultSession();
    await expect(saveEpicImport(job)).rejects.toThrow("Unlock");
    expect(mocks.request).not.toHaveBeenCalled();
    setVaultSession("owner", generateVaultContents());
    mocks.request.mockImplementation(async () => {
      setVaultSession("other", generateVaultContents());
      return { stored: false, snapshot: {} };
    });
    await expect(saveEpicImport(job)).rejects.toThrow("Vault changed");
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
it("filters and paginates locally without losing zero-valued clinical observations", () => {
  const records = Array.from({ length: 26 }, (_, i) => ({
    id: String(i),
    category: "vital-signs",
    name: "Test",
    value: i === 0 ? "0" : null,
    unit: null,
    date: "2026-11-06",
    status: null,
    source: "Epic Sandbox",
  }));
  const snapshot = { format: "medilink-epic-snapshot-v1", records, imported_at: 1 };
  const first = snapshotPage(snapshot, "all", 1),
    second = snapshotPage(snapshot, "all", 2);
  expect(first.total).toBe(26);
  expect(first.records.length).toBe(25);
  expect(second.records.length).toBe(1);
  expect([...first.records, ...second.records].find((r) => r.id === "0")?.value).toBe("0");
  expect(snapshotPage(snapshot, "laboratory", 1).records).toEqual([]);
  expect(first.counts["vital-signs"]).toBe(26);
});
