import { describe, expect, test } from "vite-plus/test";

import type { Id } from "../../../convex/_generated/dataModel";
import {
  applyBehaviorItemsToBoard,
  applyRewardRedemptionsToBoard,
  comparePointsStudents,
  formatApplyCatalogPoints,
  nextPointsSortState,
  partitionPointsCatalogByFolder,
  sortPointsStudents,
  type PointsBoardStudent,
} from "./points";

function student(
  partial: Partial<PointsBoardStudent> & { userId: Id<"users">; rosterNumber: number },
): PointsBoardStudent {
  return {
    firstName: partial.firstName,
    lastName: partial.lastName,
    name: partial.name,
    pointsBalance: partial.pointsBalance ?? 0,
    pointsAwarded: 0,
    pointsRemoved: 0,
    pointsRedeemed: 0,
    warningCount: 0,
    minusCount: 0,
    userId: partial.userId,
    rosterNumber: partial.rosterNumber,
  };
}

describe("points sort", () => {
  test("nextPointsSortState toggles direction on same key", () => {
    expect(nextPointsSortState("firstName", "asc", "firstName")).toEqual({
      sortKey: "firstName",
      sortDirection: "desc",
    });
  });

  test("names default asc; points default desc", () => {
    expect(nextPointsSortState("rosterNumber", "asc", "firstName")).toEqual({
      sortKey: "firstName",
      sortDirection: "asc",
    });
    expect(nextPointsSortState("firstName", "asc", "points")).toEqual({
      sortKey: "points",
      sortDirection: "desc",
    });
  });

  test("sorts by roster number", () => {
    const a = student({ userId: "a" as Id<"users">, rosterNumber: 2, firstName: "B" });
    const b = student({ userId: "b" as Id<"users">, rosterNumber: 1, firstName: "A" });
    expect(comparePointsStudents(a, b, "rosterNumber", "asc")).toBeGreaterThan(0);
    expect(sortPointsStudents([a, b], "rosterNumber", "asc").map((s) => s.userId)).toEqual([
      "b",
      "a",
    ]);
  });

  test("sorts by points descending", () => {
    const a = student({ userId: "a" as Id<"users">, rosterNumber: 1, pointsBalance: 5 });
    const b = student({ userId: "b" as Id<"users">, rosterNumber: 2, pointsBalance: 10 });
    expect(sortPointsStudents([a, b], "points", "desc").map((s) => s.userId)).toEqual(["b", "a"]);
  });
});

describe("partitionPointsCatalogByFolder", () => {
  const items = [
    { _id: "1", folderId: undefined as string | undefined },
    { _id: "2", folderId: "folder-a" },
    { _id: "3", folderId: "folder-b" },
  ];

  test("returns unfiled when folderId is null", () => {
    expect(partitionPointsCatalogByFolder(items, null).map((item) => item._id)).toEqual(["1"]);
  });

  test("returns items for a specific folder", () => {
    expect(partitionPointsCatalogByFolder(items, "folder-a").map((item) => item._id)).toEqual([
      "2",
    ]);
  });
});

describe("formatApplyCatalogPoints", () => {
  test("keeps stored signs on award and remove", () => {
    expect(formatApplyCatalogPoints("award", 5, "en")).toBe("+5");
    expect(formatApplyCatalogPoints("remove", -5, "en")).toBe("-5");
  });

  test("shows redeem costs as negative", () => {
    expect(formatApplyCatalogPoints("redeem", 5, "en")).toBe("-5");
    expect(formatApplyCatalogPoints("redeem", 0, "en")).toBe("0");
  });
});

describe("applyBehaviorItemsToBoard", () => {
  test("awards and removes points for selected students only", () => {
    const board = [
      student({ userId: "a" as Id<"users">, rosterNumber: 1, pointsBalance: 10 }),
      student({ userId: "b" as Id<"users">, rosterNumber: 2, pointsBalance: 4 }),
    ];
    const next = applyBehaviorItemsToBoard(
      board,
      ["a" as Id<"users">],
      [
        { points: 3, quantity: 2 },
        { points: -1, quantity: 1 },
      ],
    );
    expect(next[0]).toMatchObject({
      userId: "a",
      pointsBalance: 15,
      pointsAwarded: 6,
      pointsRemoved: 1,
      minusCount: 1,
    });
    expect(next[1]).toEqual(board[1]);
  });
});

describe("applyRewardRedemptionsToBoard", () => {
  test("deducts redeem cost from selected students only", () => {
    const board = [
      student({ userId: "a" as Id<"users">, rosterNumber: 1, pointsBalance: 20 }),
      student({ userId: "b" as Id<"users">, rosterNumber: 2, pointsBalance: 20 }),
    ];
    const next = applyRewardRedemptionsToBoard(
      board,
      ["b" as Id<"users">],
      [{ points: 5, quantity: 2 }],
    );
    expect(next[0]).toEqual(board[0]);
    expect(next[1]).toMatchObject({
      userId: "b",
      pointsBalance: 10,
      pointsRedeemed: 10,
    });
  });
});
