import { matchesCategories } from "./record-tags";
import type { GrantRecord } from "./grant-api";
import { recordSource, type RecordSource } from "./record-source";

export type RecordFilters = {
  ownership: "all" | "owned" | "shared";
  source: "all" | RecordSource;
  kind: string;
  categories?: string[];
  query: string;
  sort: "newest" | "oldest" | "name";
};
type SearchableRecord = GrantRecord & { owned: boolean; ownerName: string };

/** Combine metadata filters without fetching/decrypting private document contents. */
export function filterRecords<T extends SearchableRecord>(
  records: T[],
  filters: RecordFilters,
): T[] {
  const words = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const result = records.filter((r) => {
    if (filters.ownership !== "all" && r.owned !== (filters.ownership === "owned")) return false;
    if (filters.source !== "all" && recordSource(r) !== filters.source) return false;
    if (filters.kind !== "all" && r.kind !== filters.kind) return false;
    if (!matchesCategories(r.tags ?? [], filters.categories ?? [])) return false;
    const text = [r.name, r.id, r.kind, r.ownerName, ...(r.tags ?? [])]
      .join(" ")
      .toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  });
  const date = (r: T) => {
    const value = Date.parse(r.created_at ?? "");
    return Number.isFinite(value) ? value : null;
  };
  return result.sort((a, b) => {
    if (filters.sort === "name") return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    const aDate = date(a),
      bDate = date(b);
    if (aDate === null && bDate !== null) return 1;
    if (bDate === null && aDate !== null) return -1;
    const difference = (aDate ?? 0) - (bDate ?? 0);
    return (filters.sort === "oldest" ? difference : -difference) || a.id.localeCompare(b.id);
  });
}

/** Clamp after refresh/revocation so a shortened result set never leaves an empty page. */
export function recordPage<T>(records: T[], requestedPage: number, pageSize: number) {
  const size = Number.isFinite(pageSize) ? Math.max(1, Math.floor(pageSize)) : 25;
  const pages = Math.max(1, Math.ceil(records.length / size));
  const page = Number.isFinite(requestedPage)
    ? Math.max(1, Math.min(pages, Math.floor(requestedPage)))
    : 1;
  return { records: records.slice((page - 1) * size, page * size), page, pages };
}
