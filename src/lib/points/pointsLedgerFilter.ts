import type { PointsSortDirection } from "@/lib/points/points";

/** Description-column filter buckets for the personal points ledger. */
export type PointsLedgerDescriptionFilter = "award" | "remove" | "reward" | "warning";

export type PointsLedgerSortKey = "date" | "points";

export const POINTS_LEDGER_DESCRIPTION_FILTERS = [
  "award",
  "remove",
  "reward",
  "warning",
] as const satisfies readonly PointsLedgerDescriptionFilter[];

/** Serializable ledger fields used for worker-side filter + sort. */
export type FilterablePointsLedgerItem =
  | { id: string; at: number; kind: "behavior"; pointsApplied: number }
  | { id: string; at: number; kind: "reward"; pointsCost: number }
  | { id: string; at: number; kind: "warning" };

export type PointsLedgerFilterCriteria = {
  descriptionFilters: PointsLedgerDescriptionFilter[];
  sortKey: PointsLedgerSortKey;
  sortDirection: PointsSortDirection;
};

export type PointsLedgerFilterRequest = {
  type: "filter";
  requestId: number;
  items: FilterablePointsLedgerItem[];
  criteria: PointsLedgerFilterCriteria;
};

export type PointsLedgerFilterResponse = {
  type: "filterResult";
  requestId: number;
  ids: string[];
};

export function pointsLedgerItemKey(item: { kind: string; id: string }): string {
  return `${item.kind}:${item.id}`;
}

export function pointsLedgerDescriptionCategory(
  item:
    | FilterablePointsLedgerItem
    | { kind: "behavior"; pointsApplied: number }
    | { kind: "reward" }
    | { kind: "warning" },
): PointsLedgerDescriptionFilter {
  if (item.kind === "warning") return "warning";
  if (item.kind === "reward") return "reward";
  return item.pointsApplied < 0 ? "remove" : "award";
}

/** Signed points delta for sorting (warnings count as 0). */
export function pointsLedgerSortPoints(item: FilterablePointsLedgerItem): number {
  if (item.kind === "warning") return 0;
  if (item.kind === "reward") return -item.pointsCost;
  return item.pointsApplied;
}

export function togglePointsLedgerDescriptionFilter(
  current: ReadonlySet<PointsLedgerDescriptionFilter>,
  filter: PointsLedgerDescriptionFilter,
): Set<PointsLedgerDescriptionFilter> {
  const next = new Set(current);
  if (next.has(filter)) {
    next.delete(filter);
  } else {
    next.add(filter);
  }
  return next;
}

export function nextPointsLedgerSortState(
  currentKey: PointsLedgerSortKey,
  currentDirection: PointsSortDirection,
  nextKey: PointsLedgerSortKey,
): { sortKey: PointsLedgerSortKey; sortDirection: PointsSortDirection } {
  if (currentKey === nextKey) {
    return {
      sortKey: currentKey,
      sortDirection: currentDirection === "asc" ? "desc" : "asc",
    };
  }
  // Date: newest first. Points: high → low.
  return { sortKey: nextKey, sortDirection: "desc" };
}

export function toFilterablePointsLedgerItem(item: {
  kind: "behavior" | "reward" | "warning";
  id: string;
  at: number;
  pointsApplied?: number;
  pointsCost?: number;
}): FilterablePointsLedgerItem {
  const id = pointsLedgerItemKey(item);
  if (item.kind === "behavior") {
    return {
      id,
      at: item.at,
      kind: "behavior",
      pointsApplied: item.pointsApplied ?? 0,
    };
  }
  if (item.kind === "reward") {
    return {
      id,
      at: item.at,
      kind: "reward",
      pointsCost: item.pointsCost ?? 0,
    };
  }
  return { id, at: item.at, kind: "warning" };
}

function compareLedgerItems(
  a: FilterablePointsLedgerItem,
  b: FilterablePointsLedgerItem,
  sortKey: PointsLedgerSortKey,
  direction: PointsSortDirection,
): number {
  const dir = direction === "asc" ? 1 : -1;
  if (sortKey === "points") {
    const byPoints = pointsLedgerSortPoints(a) - pointsLedgerSortPoints(b);
    if (byPoints !== 0) return byPoints * dir;
    return (a.at - b.at) * dir;
  }
  const byDate = a.at - b.at;
  if (byDate !== 0) return byDate * dir;
  return (pointsLedgerSortPoints(a) - pointsLedgerSortPoints(b)) * dir;
}

/** Pure filter + sort used by the worker and unit tests. Returns ordered ids. */
export function filterAndSortPointsLedgerIds(
  items: readonly FilterablePointsLedgerItem[],
  criteria: PointsLedgerFilterCriteria,
): string[] {
  const filters = new Set(criteria.descriptionFilters);
  const filtered =
    filters.size === 0
      ? items
      : items.filter((item) => filters.has(pointsLedgerDescriptionCategory(item)));

  return [...filtered]
    .sort((a, b) => compareLedgerItems(a, b, criteria.sortKey, criteria.sortDirection))
    .map((item) => item.id);
}
