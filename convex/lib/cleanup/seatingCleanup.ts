import type { Id } from "../../_generated/dataModel.js";
import type { MutationCtx } from "../../_generated/server.js";

export const SEATING_PURGE_BATCH_SIZE = 25;

async function deleteSeatChartCascade(ctx: MutationCtx, chartId: Id<"seatCharts">): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- chart-bounded record list
  const records = await ctx.db
    .query("seatChartRecords")
    .withIndex("by_chart", (q) => q.eq("chartId", chartId))
    .collect();

  for (const record of records) {
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- record-bounded placement list
    const placements = await ctx.db
      .query("seatChartPlacements")
      .withIndex("by_record", (q) => q.eq("recordId", record._id))
      .collect();
    for (const placement of placements) {
      await ctx.db.delete("seatChartPlacements", placement._id);
    }
    await ctx.db.delete("seatChartRecords", record._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- chart-bounded aggregate list
  const aggregates = await ctx.db
    .query("seatChartAggregates")
    .withIndex("by_chart_student", (q) => q.eq("chartId", chartId))
    .collect();
  for (const aggregate of aggregates) {
    await ctx.db.delete("seatChartAggregates", aggregate._id);
  }

  await ctx.db.delete("seatCharts", chartId);
}

/**
 * Delete seating data for a class in bounded batches.
 * Returns true when the seating stage is fully complete.
 */
export async function deleteSeatingBatchForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<boolean> {
  const chart = await ctx.db
    .query("seatCharts")
    .withIndex("by_class", (q) => q.eq("classId", classId))
    .first();
  if (chart) {
    await deleteSeatChartCascade(ctx, chart._id);
    return false;
  }

  const chartAggregates = await ctx.db
    .query("seatChartAggregates")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .take(SEATING_PURGE_BATCH_SIZE);
  for (const row of chartAggregates) {
    await ctx.db.delete("seatChartAggregates", row._id);
  }
  if (chartAggregates.length >= SEATING_PURGE_BATCH_SIZE) {
    return false;
  }

  const layoutAggregates = await ctx.db
    .query("seatLayoutAggregates")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .take(SEATING_PURGE_BATCH_SIZE);
  for (const row of layoutAggregates) {
    await ctx.db.delete("seatLayoutAggregates", row._id);
  }
  if (layoutAggregates.length >= SEATING_PURGE_BATCH_SIZE) {
    return false;
  }

  const layout = await ctx.db
    .query("seatLayouts")
    .withIndex("by_class", (q) => q.eq("classId", classId))
    .first();
  if (layout) {
    await ctx.db.delete("seatLayouts", layout._id);
    return false;
  }

  const constraints = await ctx.db
    .query("seatConstraints")
    .withIndex("by_class", (q) => q.eq("classId", classId))
    .take(SEATING_PURGE_BATCH_SIZE);
  for (const row of constraints) {
    await ctx.db.delete("seatConstraints", row._id);
  }
  if (constraints.length >= SEATING_PURGE_BATCH_SIZE) {
    return false;
  }

  const legacySettings = await ctx.db
    .query("seatAlgorithmSettings")
    .withIndex("by_class", (q) => q.eq("classId", classId))
    .first();
  if (legacySettings) {
    await ctx.db.delete("seatAlgorithmSettings", legacySettings._id);
    return false;
  }

  return true;
}
