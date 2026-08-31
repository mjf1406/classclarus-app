import type { InfiniteData } from "@tanstack/react-query";

import type { Id } from "../../../convex/_generated/dataModel";
import type { PointsLedgerItem } from "@/hooks/points/usePointsLedgerForAudience";
import type { PointsBoard } from "@/lib/points/points";

export type PointsLedgerPage = {
  items: PointsLedgerItem[];
  nextBeforeTimestamp?: number;
  revision: { eventId: string; createdAt: number } | null;
};

export type DeletableLedgerKind = "behavior" | "reward";

export function isDeletableLedgerItem(
  item: PointsLedgerItem,
): item is Extract<PointsLedgerItem, { kind: DeletableLedgerKind }> {
  return item.kind === "behavior" || item.kind === "reward";
}

export function removeLedgerItemFromInfiniteData(
  data: InfiniteData<PointsLedgerPage> | undefined,
  kind: DeletableLedgerKind,
  entryId: string,
): InfiniteData<PointsLedgerPage> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => !(item.kind === kind && item.id === entryId)),
    })),
  };
}

/** Reverse snapshotted ledger points on a cached staff board. Leaves badge counts to refetch. */
export function applyLedgerDeleteToBoard(
  board: PointsBoard,
  studentUserId: Id<"users">,
  item: Extract<PointsLedgerItem, { kind: DeletableLedgerKind }>,
): PointsBoard {
  return board.map((student) => {
    if (student.userId !== studentUserId) return student;
    if (item.kind === "behavior") {
      const pointsApplied = item.pointsApplied;
      if (pointsApplied > 0) {
        return {
          ...student,
          pointsBalance: student.pointsBalance - pointsApplied,
          pointsAwarded: student.pointsAwarded - pointsApplied,
        };
      }
      if (pointsApplied < 0) {
        const removed = Math.abs(pointsApplied);
        return {
          ...student,
          pointsBalance: student.pointsBalance - pointsApplied,
          pointsRemoved: student.pointsRemoved - removed,
        };
      }
      return student;
    }
    return {
      ...student,
      pointsBalance: student.pointsBalance + item.pointsCost,
      pointsRedeemed: student.pointsRedeemed - item.pointsCost,
    };
  });
}
