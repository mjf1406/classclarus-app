import { describe, expect, it } from "vite-plus/test";

import {
  nextEquitableAssignerRunSortState,
  sortEquitableAssignerRuns,
  type EquitableAssignerRunListItem,
} from "@/lib/assigners/equitableAssigners";
import type { Id } from "../../../convex/_generated/dataModel";

function run(
  partial: Partial<EquitableAssignerRunListItem> & Pick<EquitableAssignerRunListItem, "_id">,
): EquitableAssignerRunListItem {
  return {
    _creationTime: 0,
    assignerId: "assigner" as Id<"equitableAssigners">,
    ranAt: 0,
    ranBy: "user" as Id<"users">,
    scope: "class",
    balanceGender: false,
    genderBuckets: [],
    assignmentCount: 0,
    ...partial,
  };
}

describe("sortEquitableAssignerRuns", () => {
  it("sorts by ranAt descending by default", () => {
    const runs = [
      run({ _id: "a" as Id<"equitableAssignerRuns">, ranAt: 100 }),
      run({ _id: "b" as Id<"equitableAssignerRuns">, ranAt: 200 }),
    ];
    const sorted = sortEquitableAssignerRuns(runs, "ranAt", "desc");
    expect(sorted.map((r) => r._id)).toEqual(["b", "a"]);
  });
});

describe("nextEquitableAssignerRunSortState", () => {
  it("toggles direction when clicking the same column", () => {
    expect(nextEquitableAssignerRunSortState("ranAt", "desc", "ranAt")).toEqual({
      sortKey: "ranAt",
      sortDirection: "asc",
    });
  });
});
