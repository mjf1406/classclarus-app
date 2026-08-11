import { describe, expect, it } from "vite-plus/test";

import {
  nextRandomAssignerRunSortState,
  sortRandomAssignerRuns,
  type RandomAssignerRunListItem,
} from "@/lib/assigners/randomAssigners";
import type { Id } from "../../../convex/_generated/dataModel";

function run(
  overrides: Partial<RandomAssignerRunListItem> & Pick<RandomAssignerRunListItem, "_id" | "ranAt">,
): RandomAssignerRunListItem {
  return {
    _creationTime: overrides.ranAt,
    assignerId: "assigner" as Id<"randomAssigners">,
    ranBy: "user" as Id<"users">,
    scope: "class",
    replicates: false,
    assignmentCount: 1,
    ...overrides,
  };
}

describe("nextRandomAssignerRunSortState", () => {
  it("toggles direction when the same key is selected", () => {
    expect(nextRandomAssignerRunSortState("ranAt", "desc", "ranAt")).toEqual({
      sortKey: "ranAt",
      sortDirection: "asc",
    });
  });

  it("defaults numeric keys to desc and others to asc", () => {
    expect(nextRandomAssignerRunSortState("ranAt", "desc", "scope")).toEqual({
      sortKey: "scope",
      sortDirection: "asc",
    });
    expect(nextRandomAssignerRunSortState("scope", "asc", "assignmentCount")).toEqual({
      sortKey: "assignmentCount",
      sortDirection: "desc",
    });
  });
});

describe("sortRandomAssignerRuns", () => {
  const rows = [
    run({
      _id: "a" as Id<"randomAssignerRuns">,
      ranAt: 300,
      scope: "groups",
      replicates: true,
      assignmentCount: 2,
    }),
    run({
      _id: "b" as Id<"randomAssignerRuns">,
      ranAt: 100,
      scope: "class",
      replicates: false,
      assignmentCount: 5,
    }),
    run({
      _id: "c" as Id<"randomAssignerRuns">,
      ranAt: 200,
      scope: "class",
      replicates: true,
      assignmentCount: 2,
    }),
  ];

  it("sorts by ranAt descending by default path", () => {
    expect(sortRandomAssignerRuns(rows, "ranAt", "desc").map((row) => row._id)).toEqual([
      "a",
      "c",
      "b",
    ]);
  });

  it("sorts by scope ascending", () => {
    expect(sortRandomAssignerRuns(rows, "scope", "asc").map((row) => row._id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("sorts by replicates then ranAt", () => {
    expect(sortRandomAssignerRuns(rows, "replicates", "asc").map((row) => row._id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("sorts by assignmentCount descending", () => {
    expect(sortRandomAssignerRuns(rows, "assignmentCount", "desc").map((row) => row._id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });
});
