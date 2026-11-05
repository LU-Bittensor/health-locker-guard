import { describe, expect, it } from "vitest";
import { isWalletRegistryGrant, sharingMode } from "@/lib/sharing-mode";

describe("Epic and wallet sharing compatibility", () => {
  const report = { id: "epic-import-saved-snapshot" };
  const upload = { id: "uploaded-document" };

  it("keeps Epic delivery on the API when wallet sharing is configured", () => {
    expect(sharingMode([report], true)).toBe("api");
    expect(sharingMode([report], false)).toBe("api");
    expect(sharingMode([upload], true)).toBe("wallet");
    expect(sharingMode([upload], false)).toBe("api");
  });

  it("rejects mixed wallet/report batches before any grant is submitted", () => {
    expect(() => sharingMode([report, upload], true)).toThrow(/separately/);
    expect(sharingMode([report, upload], false)).toBe("api");
  });

  it("routes checks and revocation by the grant origin, not current registry configuration", () => {
    const apiGrant = {
      id: "fa481294-8901-4c66-9831-51bcc206ff98",
      chain_enabled: true,
      record_ids: [upload.id],
      recipient_id: "recipient",
    };
    expect(isWalletRegistryGrant(apiGrant)).toBe(false);
    expect(isWalletRegistryGrant({ ...apiGrant, chain_enabled: false })).toBe(false);
    expect(isWalletRegistryGrant({ ...apiGrant, id: "uploaded-document:recipient" })).toBe(true);
    expect(isWalletRegistryGrant({ ...apiGrant, id: "uploaded-document:outsider" })).toBe(false);
  });
});
