import { describe, expect, test } from "vite-plus/test";

import {
  filterAndSortPointsLedgerIds,
  nextPointsLedgerSortState,
  pointsLedgerDescriptionCategory,
  pointsLedgerItemKey,
  pointsLedgerSortPoints,
  toFilterablePointsLedgerItem,
  togglePointsLedgerDescriptionFilter,
  type FilterablePointsLedgerItem,
} from "./pointsLedgerFilter";

describe("points ledger filter", () => {
  const award: FilterablePointsLedgerItem = {
    id: "behavior:a",
    kind: "behavior",
    pointsApplied: 5,
    at: 3,
  };
  const remove: FilterablePointsLedgerItem = {
    id: "behavior:b",
    kind: "behavior",
    pointsApplied: -2,
    at: 2,
  };
  const reward: FilterablePointsLedgerItem = {
    id: "reward:c",
    kind: "reward",
    pointsCost: 4,
    at: 1,
  };
  const warning: FilterablePointsLedgerItem = { id: "warning:d", kind: "warning", at: 4 };

  test("builds composite keys", () => {
    expect(pointsLedgerItemKey({ kind: "behavior", id: "a" })).toBe("behavior:a");
  });

  test("categorizes by kind and award/remove sign", () => {
    expect(pointsLedgerDescriptionCategory(award)).toBe("award");
    expect(pointsLedgerDescriptionCategory(remove)).toBe("remove");
    expect(pointsLedgerDescriptionCategory(reward)).toBe("reward");
    expect(pointsLedgerDescriptionCategory(warning)).toBe("warning");
  });

  test("signed points for sort", () => {
    expect(pointsLedgerSortPoints(award)).toBe(5);
    expect(pointsLedgerSortPoints(remove)).toBe(-2);
    expect(pointsLedgerSortPoints(reward)).toBe(-4);
    expect(pointsLedgerSortPoints(warning)).toBe(0);
  });

  test("toFilterablePointsLedgerItem maps ledger rows", () => {
    expect(
      toFilterablePointsLedgerItem({
        kind: "behavior",
        id: "a",
        at: 3,
        pointsApplied: 5,
      }),
    ).toEqual(award);
    expect(
      toFilterablePointsLedgerItem({
        kind: "reward",
        id: "c",
        at: 1,
        pointsCost: 4,
      }),
    ).toEqual(reward);
  });

  test("empty filters keep all ids, sorted by date", () => {
    expect(
      filterAndSortPointsLedgerIds([award, remove, reward, warning], {
        descriptionFilters: [],
        sortKey: "date",
        sortDirection: "desc",
      }),
    ).toEqual(["warning:d", "behavior:a", "behavior:b", "reward:c"]);
  });

  test("filters to selected description categories", () => {
    expect(
      filterAndSortPointsLedgerIds([award, remove, reward, warning], {
        descriptionFilters: ["award", "reward"],
        sortKey: "date",
        sortDirection: "asc",
      }),
    ).toEqual(["reward:c", "behavior:a"]);
  });

  test("sorts by signed points descending", () => {
    expect(
      filterAndSortPointsLedgerIds([award, remove, reward, warning], {
        descriptionFilters: [],
        sortKey: "points",
        sortDirection: "desc",
      }),
    ).toEqual(["behavior:a", "warning:d", "behavior:b", "reward:c"]);
  });

  test("nextPointsLedgerSortState toggles and defaults to desc", () => {
    expect(nextPointsLedgerSortState("date", "desc", "date")).toEqual({
      sortKey: "date",
      sortDirection: "asc",
    });
    expect(nextPointsLedgerSortState("date", "asc", "points")).toEqual({
      sortKey: "points",
      sortDirection: "desc",
    });
  });

  test("toggles description filters", () => {
    const withAward = togglePointsLedgerDescriptionFilter(new Set(), "award");
    expect([...withAward]).toEqual(["award"]);
    expect([...togglePointsLedgerDescriptionFilter(withAward, "award")]).toEqual([]);
  });
});
