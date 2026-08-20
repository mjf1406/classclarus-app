import type { Id } from "../../_generated/dataModel.js";
import type { QueryCtx } from "../../_generated/server.js";
import { seatHistoryKey } from "./historyKeys.js";
import type { SeatLayoutMatrixDimension } from "./layoutRosterMatrix.js";

export type LayoutHistoryPlacementMatchInput = {
  deskItemId: string;
  zoneName?: string;
  teamKey?: string;
  neighborStudentIds: Array<Id<"users">>;
};

export type LayoutStudentHistoryItem = {
  recordId: Id<"seatChartRecords">;
  recordedAt: number;
};

export function matchesLayoutHistoryDimension(
  row: LayoutHistoryPlacementMatchInput,
  layoutId: Id<"seatLayouts">,
  dimension: SeatLayoutMatrixDimension,
  key: string,
): boolean {
  switch (dimension) {
    case "seat":
      return seatHistoryKey(layoutId, row.deskItemId) === key;
    case "zone":
      return row.zoneName === key;
    case "team":
      return row.teamKey === key;
    case "neighbor":
      return row.neighborStudentIds.some((neighborId) => neighborId === key);
  }
}

export async function loadLayoutStudentHistoryPage(
  ctx: QueryCtx,
  args: {
    layoutId: Id<"seatLayouts">;
    studentUserId: Id<"users">;
    dimension: SeatLayoutMatrixDimension;
    key: string;
    beforeRecordedAt?: number;
    limit: number;
    maxScan: number;
  },
): Promise<{
  items: LayoutStudentHistoryItem[];
  nextBeforeRecordedAt?: number;
}> {
  const scanBatchSize = Math.min(Math.max(args.limit * 5, 50), args.maxScan);
  const items: LayoutStudentHistoryItem[] = [];
  let lastScannedRecordedAt: number | undefined;
  let hasMoreSource = true;

  while (items.length < args.limit && hasMoreSource) {
    const cursor = lastScannedRecordedAt ?? args.beforeRecordedAt;
    const batch =
      cursor !== undefined
        ? await ctx.db
            .query("seatChartPlacements")
            .withIndex("by_layout_student_recorded", (q) =>
              q
                .eq("layoutId", args.layoutId)
                .eq("studentUserId", args.studentUserId)
                .lt("recordedAt", cursor),
            )
            .order("desc")
            .take(scanBatchSize)
        : await ctx.db
            .query("seatChartPlacements")
            .withIndex("by_layout_student_recorded", (q) =>
              q.eq("layoutId", args.layoutId).eq("studentUserId", args.studentUserId),
            )
            .order("desc")
            .take(scanBatchSize);

    if (batch.length === 0) {
      break;
    }

    for (const row of batch) {
      lastScannedRecordedAt = row.recordedAt;
      if (!matchesLayoutHistoryDimension(row, args.layoutId, args.dimension, args.key)) {
        continue;
      }
      items.push({
        recordId: row.recordId,
        recordedAt: row.recordedAt,
      });
      if (items.length >= args.limit) break;
    }

    if (batch.length < scanBatchSize && items.length < args.limit) {
      hasMoreSource = false;
    }
  }

  const lastItem = items.at(-1);
  return {
    items,
    ...(items.length >= args.limit && lastItem
      ? { nextBeforeRecordedAt: lastItem.recordedAt }
      : {}),
  };
}
