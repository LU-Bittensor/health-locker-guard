import { describe, expect, it } from "vitest";
import { recordSource } from "./record-source";

describe("unified record sources", () => {
  it("identifies encrypted Epic snapshots with ordinary UUID identifiers", () => {
    expect(recordSource({ id: "db40a157-2a86-4312-b9e7-cce9e1bb9ad2", kind: "Epic import" })).toBe(
      "epic",
    );
  });
  it("identifies legacy imports with their saved metadata or legacy identifier", () => {
    expect(recordSource({ id: "report", kind: "Epic import (legacy)" })).toBe("epic");
    expect(recordSource({ id: "epic-import-report", kind: "Historical report" })).toBe("epic");
  });
  it("keeps uploaded documents and wallet discoveries in MediLink", () => {
    for (const kind of ["Document", "Lab report", "Imaging", "On-chain share"])
      expect(recordSource({ id: "record", kind })).toBe("medilink");
  });
});
