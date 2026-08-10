import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel.js";
import { internalMutation } from "./_generated/server.js";
import {
  applyPlacementAggregates,
  buildPlacementSnapshots,
  type ChartAssignment,
  type PlacementSnapshot,
} from "./lib/seatChartLogic.js";

function resolveGroupIdForPlacement(args: {
  placement: Doc<"seatChartPlacements">;
  chartAssignments: Doc<"seatCharts">["assignments"];
  membershipGroupId?: Id<"groups">;
}): Id<"groups"> | null {
  if ("groupId" in args.placement && args.placement.groupId) {
    return args.placement.groupId;
  }
  const fromChart = args.chartAssignments.find(
    (assignment) => assignment.studentUserId === args.placement.studentUserId,
  )?.groupId;
  if (fromChart) return fromChart;
  return args.membershipGroupId ?? null;
}

/**
 * One-shot repair: same-group neighbors, layoutId/groupId on placements, rebuilt aggregates.
 */
export const repairPlacementsAndAggregates = internalMutation({
  args: {
    classId: v.optional(v.id("classes")),
  },
  returns: v.object({
    recordsProcessed: v.number(),
    placementsPatched: v.number(),
    chartsRebuilt: v.number(),
  }),
  handler: async (ctx, args) => {
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- one-shot repair scans all records
    const records = await ctx.db.query("seatChartRecords").collect();
    const filteredRecords = args.classId
      ? records.filter((record) => record.classId === args.classId)
      : records;

    const chartsToRebuild = new Set<Id<"seatCharts">>();
    let placementsPatched = 0;

    for (const record of filteredRecords) {
      chartsToRebuild.add(record.chartId);
      const chart = await ctx.db.get("seatCharts", record.chartId);
      if (!chart) continue;

      const classDoc = await ctx.db.get("classes", record.classId);
      if (!classDoc) continue;

      const membershipByStudent = new Map<Id<"users">, Id<"groups">>();
      // eslint-disable-next-line @convex-dev/no-collect-in-query -- class-bounded repair
      const memberships = await ctx.db
        .query("groupMemberships")
        .withIndex("by_class", (q) => q.eq("classId", record.classId))
        .collect();
      for (const membership of memberships) {
        membershipByStudent.set(membership.studentUserId, membership.groupId);
      }

      // eslint-disable-next-line @convex-dev/no-collect-in-query -- record-bounded placements
      const placements = await ctx.db
        .query("seatChartPlacements")
        .withIndex("by_record", (q) => q.eq("recordId", record._id))
        .collect();

      const assignments: Array<ChartAssignment> = [];
      for (const placement of placements) {
        const groupId = resolveGroupIdForPlacement({
          placement,
          chartAssignments: chart.assignments,
          membershipGroupId: membershipByStudent.get(placement.studentUserId),
        });
        if (!groupId) continue;
        assignments.push({
          deskItemId: placement.deskItemId,
          groupId,
          studentUserId: placement.studentUserId,
        });
      }

      const frozenLayout = {
        _id: record.layoutId,
        items: record.layoutItems,
      } as Doc<"seatLayouts">;

      const snapshots = await buildPlacementSnapshots(ctx, classDoc, frozenLayout, assignments);
      const snapshotByStudent = new Map(
        snapshots.map((snapshot) => [snapshot.studentUserId, snapshot]),
      );

      for (const placement of placements) {
        const snapshot = snapshotByStudent.get(placement.studentUserId);
        if (!snapshot) continue;

        await ctx.db.patch("seatChartPlacements", placement._id, {
          layoutId: record.layoutId,
          groupId: snapshot.groupId,
          neighborStudentIds: snapshot.neighborStudentIds,
          neighborDisplayNames: snapshot.neighborDisplayNames,
          combinationKey: snapshot.combinationKey,
        });
        placementsPatched += 1;
      }
    }

    let chartsRebuilt = 0;
    for (const chartId of chartsToRebuild) {
      const chart = await ctx.db.get("seatCharts", chartId);
      if (!chart) continue;

      // eslint-disable-next-line @convex-dev/no-collect-in-query -- one-shot chart repair rebuild
      const aggregateRows = (await ctx.db.query("seatChartAggregates").collect()).filter(
        (row) => row.chartId === chartId,
      );
      for (const row of aggregateRows) {
        await ctx.db.delete("seatChartAggregates", row._id);
      }

      // eslint-disable-next-line @convex-dev/no-collect-in-query -- one-shot chart repair rebuild
      const chartPlacements = (await ctx.db.query("seatChartPlacements").collect())
        .filter((placement) => placement.chartId === chartId)
        .sort((a, b) => a.recordedAt - b.recordedAt);

      for (const placement of chartPlacements) {
        const groupId =
          "groupId" in placement && placement.groupId
            ? placement.groupId
            : chart.assignments.find((a) => a.studentUserId === placement.studentUserId)?.groupId;
        if (!groupId) continue;

        const snapshot: PlacementSnapshot = {
          studentUserId: placement.studentUserId,
          studentDisplayName: placement.studentDisplayName,
          deskItemId: placement.deskItemId,
          groupId,
          ...(placement.deskNumber !== undefined ? { deskNumber: placement.deskNumber } : {}),
          ...(placement.zoneName !== undefined ? { zoneName: placement.zoneName } : {}),
          ...(placement.teamKey !== undefined ? { teamKey: placement.teamKey } : {}),
          ...(placement.teamLabel !== undefined ? { teamLabel: placement.teamLabel } : {}),
          neighborStudentIds: placement.neighborStudentIds,
          neighborDisplayNames: placement.neighborDisplayNames,
          combinationKey: placement.combinationKey,
        };

        await applyPlacementAggregates(ctx, {
          classId: chart.classId,
          chartId,
          layoutId: chart.layoutId,
          placement: snapshot,
          now: placement.recordedAt,
        });
      }

      chartsRebuilt += 1;
    }

    return {
      recordsProcessed: filteredRecords.length,
      placementsPatched,
      chartsRebuilt,
    };
  },
});
