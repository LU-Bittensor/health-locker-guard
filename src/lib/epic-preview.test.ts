import { describe, expect, it } from "vitest";
import { epicPreview } from "./epic-preview";

describe("saved import preview", () => {
  it("shows clinical details, empty categories and immutable sharing scope", () => {
    const text = epicPreview(
      JSON.stringify({
        format: "medilink-epic-snapshot-v1",
        imported_at: 1794000000,
        coverage_note: "Sandbox data only",
        records: [
          {
            category: "vital-signs",
            name: "Pulse",
            value: "0",
            unit: "/min",
            date: null,
            status: "final",
          },
          { category: "laboratory", name: "Lab", value: null },
        ],
      }),
    );
    expect(text).toContain("Pulse\n  Value / details: 0 /min");
    expect(text).toContain("Value / details: Not provided");
    expect(text).toContain("Conditions (0)");
    expect(text).toContain("Sandbox data only");
    expect(text).toContain("Later imports are not included");
    expect(text).not.toContain('"format"');
  });
  it("preserves legacy text and unrelated JSON", () => {
    for (const value of [
      "legacy report",
      '{"other":"document"}',
      "null",
      '{"format":"medilink-epic-snapshot-v1"}',
    ])
      expect(epicPreview(value)).toBe(value);
  });
});
