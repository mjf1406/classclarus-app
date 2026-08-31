import { describe, expect, test } from "vite-plus/test";

import type { Id } from "../../../convex/_generated/dataModel";
import type { PointsLedgerItem } from "@/hooks/points/usePointsLedgerForAudience";
import type { PointsBoardStudent } from "@/lib/points/points";
import {
  applyLedgerDeleteToBoard,
  isDeletableLedgerItem,
  removeLedgerItemFromInfiniteData,
  type PointsLedgerPage,
} from "./pointsLedgerOptimistic";

function student(
  partial: Partial<PointsBoardStudent> & { userId: Id<"users"> },
): PointsBoardStudent {
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    name: "Ada Lovelace",
    pointsBalance: 20,
    pointsAwarded: 30,
    pointsRemoved: 5,
    pointsRedeemed: 5,
    warningCount: 0,
    minusCount: 1,
    rosterNumber: 1,
    ...partial,
  };
}

const award: Extract<PointsLedgerItem, { kind: "behavior" }> = {
  kind: "behavior",
  id: "b1" as Id<"behaviorApplications">,
  at: 2,
  name: "On task",
  pointsApplied: 5,
  quantity: 1,
};

const deduction: Extract<PointsLedgerItem, { kind: "behavior" }> = {
  kind: "behavior",
  id: "b2" as Id<"behaviorApplications">,
  at: 1,
  name: "Off task",
  pointsApplied: -3,
  quantity: 1,
};

const reward: Extract<PointsLedgerItem, { kind: "reward" }> = {
  kind: "reward",
  id: "r1" as Id<"rewardPurchases">,
  at: 3,
  name: "Sticker",
  pointsCost: 4,
  quantity: 1,
};

const warning: Extract<PointsLedgerItem, { kind: "warning" }> = {
  kind: "warning",
  id: "w1" as Id<"studentWarningEvents">,
  at: 4,
  dateKey: "2026-08-31",
};

describe("isDeletableLedgerItem", () => {
  test("allows behavior and reward rows only", () => {
    expect(isDeletableLedgerItem(award)).toBe(true);
    expect(isDeletableLedgerItem(reward)).toBe(true);
    expect(isDeletableLedgerItem(warning)).toBe(false);
  });
});

describe("removeLedgerItemFromInfiniteData", () => {
  test("removes the matching row and leaves other pages intact", () => {
    const data = {
      pageParams: [undefined, 2],
      pages: [
        { items: [reward, award], revision: null, nextBeforeTimestamp: 2 },
        { items: [deduction], revision: null },
      ] satisfies PointsLedgerPage[],
    };

    const next = removeLedgerItemFromInfiniteData(data, "behavior", award.id);
    expect(next?.pages[0]?.items).toEqual([reward]);
    expect(next?.pages[1]?.items).toEqual([deduction]);
  });

  test("returns undefined when there is no cached data", () => {
    expect(removeLedgerItemFromInfiniteData(undefined, "reward", reward.id)).toBeUndefined();
  });
});

describe("applyLedgerDeleteToBoard", () => {
  const studentId = "s1" as Id<"users">;
  const otherId = "s2" as Id<"users">;
  const board = [student({ userId: studentId }), student({ userId: otherId, rosterNumber: 2 })];

  test("reverses an award without changing other students", () => {
    const next = applyLedgerDeleteToBoard(board, studentId, award);
    expect(next[0]).toMatchObject({
      pointsBalance: 15,
      pointsAwarded: 25,
      pointsRemoved: 5,
      minusCount: 1,
    });
    expect(next[1]).toEqual(board[1]);
  });

  test("reverses a deduction", () => {
    const next = applyLedgerDeleteToBoard(board, studentId, deduction);
    expect(next[0]).toMatchObject({
      pointsBalance: 23,
      pointsAwarded: 30,
      pointsRemoved: 2,
    });
  });

  test("reverses a reward redemption", () => {
    const next = applyLedgerDeleteToBoard(board, studentId, reward);
    expect(next[0]).toMatchObject({
      pointsBalance: 24,
      pointsRedeemed: 1,
    });
  });
});
