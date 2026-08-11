import { v } from "convex/values";

import { internalMutation } from "./_generated/server.js";
import {
  applyLayoutPlacementAggregates,
  buildPlacementSnapshots,
  deskItemsById,
  type ChartAssignment,
} from "./lib/seatChartLogic.js";

const BATCH_SIZE = 50;

/**
 * Rebuild layout-level seating aggregates from historical placements.
 * Pass cursor=null to clear existing layout aggregates first (required once per rebuild).
 */
export const backfillFromPlacements = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    classId: v.optional(v.id("classes")),
  },
  returns: v.object({
    processed: v.number(),
    continueCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
    cleared: v.boolean(),
  }),
  handler: async (ctx, args) => {
    let cleared = false;
    if (!args.cursor) {
      // eslint-disable-next-line @convex-dev/no-collect-in-query -- one-shot rebuild clear
      const existing = await ctx.db.query("seatLayoutAggregates").collect();
      for (const row of existing) {
        if (args.classId && row.classId !== args.classId) continue;
        await ctx.db.delete("seatLayoutAggregates", row._id);
      }
      cleared = true;
    }

    const page = await ctx.db
      .query("seatChartPlacements")
      .paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null });

    let processed = 0;
    for (const placement of page.page) {
      if (args.classId && placement.classId !== args.classId) continue;
      if (!placement.layoutId || !placement.groupId) continue;

      const classDoc = await ctx.db.get("classes", placement.classId);
      if (!classDoc) continue;

      const layout = await ctx.db.get("seatLayouts", placement.layoutId);
      if (!layout) continue;

      const assignments: Array<ChartAssignment> = [
        {
          deskItemId: placement.deskItemId,
          groupId: placement.groupId,
          studentUserId: placement.studentUserId,
        },
      ];

      deskItemsById(layout.items);
      const snapshots = await buildPlacementSnapshots(ctx, classDoc, layout, assignments);
      const snapshot = snapshots[0];
      if (!snapshot) continue;

      await applyLayoutPlacementAggregates(ctx, {
        classId: placement.classId,
        layoutId: placement.layoutId,
        placement: snapshot,
        now: placement.recordedAt,
      });
      processed += 1;
    }

    return {
      processed,
      continueCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
      cleared,
    };
  },
});
