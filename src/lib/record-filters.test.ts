import { describe, expect, it } from "vitest";
import { filterRecords, recordPage, type RecordFilters } from "./record-filters";

const defaults: RecordFilters = {
  ownership: "all",
  source: "all",
  kind: "all",
  query: "",
  sort: "newest",
};
const rows = [
  {
    id: "upload",
    name: "Annual Lab",
    kind: "Lab report",
    tags: ["annual"],
    owned: true,
    ownerName: "Patient",
    created_at: "2026-11-01",
  },
  {
    id: "snapshot",
    name: "Epic November",
    kind: "Epic import",
    tags: ["labs"],
    owned: true,
    ownerName: "Patient",
    created_at: "2026-11-08",
  },
  {
    id: "incoming",
    name: "Epic Shared",
    kind: "Epic import",
    tags: ["review"],
    owned: false,
    ownerName: "Sender Cedar",
    created_at: "2026-11-09",
  },
  {
    id: "undated",
    name: "Unknown date",
    kind: "Document",
    owned: false,
    ownerName: "Sender Birch",
    created_at: "invalid",
  },
];
const ids = (filters: Partial<RecordFilters>) =>
  filterRecords(rows, { ...defaults, ...filters }).map((r) => r.id);

describe("unified record filtering and paging", () => {
  it("combines ownership, source, record type and all search words", () => {
    expect(
      ids({ ownership: "owned", source: "epic", kind: "Epic import", query: "NOVEMBER labs" }),
    ).toEqual(["snapshot"]);
    expect(ids({ ownership: "shared", source: "epic" })).toEqual(["incoming"]);
    expect(ids({ ownership: "owned", source: "medilink", kind: "Epic import" })).toEqual([]);
  });
  it("searches names, tags, sender and IDs without reading document contents", () => {
    expect(ids({ query: "  ANNUAL  " })).toEqual(["upload"]);
    expect(ids({ query: "sender Cedar" })).toEqual(["incoming"]);
    expect(ids({ query: "snapshot" })).toEqual(["snapshot"]);
    expect(ids({ query: "secret clinical value" })).toEqual([]);
  });
  it("sorts dates in both directions with undated records last and keeps the input intact", () => {
    expect(ids({})).toEqual(["incoming", "snapshot", "upload", "undated"]);
    expect(ids({ sort: "oldest" })).toEqual(["upload", "snapshot", "incoming", "undated"]);
    expect(ids({ sort: "name" })).toEqual(["upload", "snapshot", "incoming", "undated"]);
    expect(rows.map((r) => r.id)).toEqual(["upload", "snapshot", "incoming", "undated"]);
  });
  it("paginates the filtered result without skipping or repeating records", () => {
    const matches = filterRecords(rows, defaults);
    expect(recordPage(matches, 1, 2).records.map((r) => r.id)).toEqual(["incoming", "snapshot"]);
    expect(recordPage(matches, 2, 2).records.map((r) => r.id)).toEqual(["upload", "undated"]);
    expect(recordPage(matches, 2, 2).pages).toBe(2);
  });
  it("clamps to a valid page after filtering or revoked records disappear", () => {
    const result = recordPage(rows.slice(0, 1), 9, 25);
    expect(result.page).toBe(1);
    expect(result.records).toEqual(rows.slice(0, 1));
    expect(recordPage([], 5, 25)).toEqual({ records: [], page: 1, pages: 1 });
  });
});
