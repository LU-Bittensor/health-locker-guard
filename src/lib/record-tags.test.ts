import { describe, expect, it } from "vitest";
import {
  RECORD_CATEGORIES,
  categoryLabel,
  matchesCategories,
  serializeRecordTags,
} from "./record-tags";
import { filterRecords } from "./record-filters";

describe("record category compatibility", () => {
  it("has thirteen unique local labels fitting the existing API", () => {
    expect(RECORD_CATEGORIES).toHaveLength(13);
    expect(new Set(RECORD_CATEGORIES.map((c) => c.id)).size).toBe(13);
    expect(() => serializeRecordTags(RECORD_CATEGORIES.map((c) => c.label))).not.toThrow();
  });
  it("recognizes whole aliases case-insensitively without relabeling unknown legacy values", () => {
    expect(categoryLabel("  LABS ")).toBe("Lab results");
    expect(categoryLabel("vaccinations")).toBe("Immunizations");
    expect(categoryLabel("annual checkup")).toBe("annual checkup");
    expect(categoryLabel("HIV labs")).toBe("HIV labs");
  });
  it("uses OR for selected categories and supports exact existing custom tags", () => {
    expect(matchesCategories(["labs"], ["Lab results", "Imaging"])).toBe(true);
    expect(matchesCategories(["imaging"], ["Lab results", "Imaging"])).toBe(true);
    expect(matchesCategories(["annual checkup"], ["annual checkup"])).toBe(true);
    expect(matchesCategories(["lab results draft"], ["Lab results"])).toBe(false);
    expect(matchesCategories([], [])).toBe(true);
    expect(matchesCategories([], ["Other"])).toBe(false);
  });
  it("preserves strings, allows no tags, and enforces server limits", () => {
    expect(serializeRecordTags([])).toBe("");
    expect(serializeRecordTags(["Lab results", "annual checkup", "Lab results"])).toBe(
      "Lab results, annual checkup",
    );
    for (const tags of [
      [""],
      ["a,b"],
      ["a".repeat(51)],
      Array.from({ length: 21 }, (_, i) => String(i)),
      Array.from({ length: 20 }, (_, i) => String(i).padEnd(50, "x")),
    ])
      expect(() => serializeRecordTags(tags)).toThrow();
  });
  it("ANDs categories with ownership/source/type/search without mutating record tags", () => {
    const record = {
      id: "saved",
      name: "Annual results",
      kind: "Document",
      owned: true,
      ownerName: "Owner",
      tags: ["labs", "annual checkup"],
    };
    const base = {
      ownership: "owned",
      source: "medilink",
      kind: "Document",
      query: "annual",
      sort: "newest",
      categories: ["Lab results"],
    } as const;
    expect(filterRecords([record], { ...base, categories: [...base.categories] })).toEqual([
      record,
    ]);
    expect(
      filterRecords([record], { ...base, ownership: "shared", categories: [...base.categories] }),
    ).toEqual([]);
    expect(record.tags).toEqual(["labs", "annual checkup"]);
  });
});
