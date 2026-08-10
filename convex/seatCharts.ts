import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel.js";
import type { QueryCtx } from "./_generated/server.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import {
  applyPlacementAggregates,
  evaluateConstraintViolations,
  DEFAULT_HISTORY_LIMIT,
  MAX_HISTORY_LIMIT,
  normalizeChartName,
  normalizeDraftAssignments,
  requireStudentInClass,
  resolveStudentDisplayName,
  seatAggregateKey,
  seatAggregateLabel,
  deskItemsById,
  buildPlacementSnapshots,
  syncMembershipTeamsFromSeating,
} from "./lib/seatChartLogic.js";

const chartAssignmentValidator = v.object({
  deskItemId: v.string(),
  groupId: v.optional(v.id("groups")),
  studentUserId: v.id("users"),
});

const seatLayoutItemSnapshotValidator = v.object({
  id: v.string(),
  kind: v.union(v.literal("desk"), v.literal("teacherDesk"), v.literal("board"), v.literal("rect")),
  label: v.string(),
  deskNumber: v.optional(v.number()),
  teamAssignment: v.optional(
    v.union(
      v.object({
        mode: v.literal("single"),
        groupId: v.id("groups"),
        teamId: v.id("teams"),
      }),
      v.object({
        mode: v.literal("byName"),
        teamName: v.string(),
      }),
    ),
  ),
  zoneName: v.optional(v.string()),
  x: v.number(),
  y: v.number(),
  width: v.number(),
  height: v.number(),
});

const chartListItemValidator = v.object({
  _id: v.id("seatCharts"),
  _creationTime: v.number(),
  name: v.string(),
  layoutId: v.id("seatLayouts"),
  layoutName: v.string(),
  updatedAt: v.number(),
  recordCount: v.number(),
  seatedCount: v.number(),
  archivedAt: v.optional(v.number()),
});

const chartValidator = v.object({
  _id: v.id("seatCharts"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  layoutId: v.id("seatLayouts"),
  name: v.string(),
  archivedAt: v.optional(v.number()),
  assignments: v.array(chartAssignmentValidator),
  updatedAt: v.number(),
  createdBy: v.id("users"),
  layout: v.object({
    _id: v.id("seatLayouts"),
    name: v.string(),
    canvasWidth: v.number(),
    canvasHeight: v.number(),
    items: v.array(seatLayoutItemSnapshotValidator),
  }),
});

const violationValidator = v.object({
  constraintId: v.id("seatConstraints"),
  type: v.union(v.literal("neighbor"), v.literal("teammate"), v.literal("zone")),
  polarity: v.union(v.literal("must"), v.literal("mustNot")),
  summary: v.string(),
  studentUserIds: v.array(v.id("users")),
});

const aggregateRowValidator = v.object({
  dimension: v.union(
    v.literal("total"),
    v.literal("seat"),
    v.literal("zone"),
    v.literal("team"),
    v.literal("neighbor"),
    v.literal("combination"),
  ),
  key: v.string(),
  label: v.string(),
  count: v.number(),
});

const studentSummaryValidator = v.object({
  studentUserId: v.id("users"),
  totalRecorded: v.number(),
  draftPlacement: v.optional(
    v.object({
      deskItemId: v.string(),
      deskNumber: v.optional(v.number()),
      zoneName: v.optional(v.string()),
      teamLabel: v.optional(v.string()),
      neighborDisplayNames: v.array(v.string()),
      isDraft: v.literal(true),
    }),
  ),
  currentContextCounts: v.object({
    seat: v.optional(v.object({ count: v.number(), percent: v.number(), label: v.string() })),
    zone: v.optional(v.object({ count: v.number(), percent: v.number(), label: v.string() })),
    team: v.optional(v.object({ count: v.number(), percent: v.number(), label: v.string() })),
    neighbors: v.array(
      v.object({
        studentUserId: v.id("users"),
        label: v.string(),
        count: v.number(),
        percent: v.number(),
      }),
    ),
    combination: v.optional(
      v.object({ count: v.number(), percent: v.number(), label: v.string() }),
    ),
  }),
  breakdowns: v.object({
    seats: v.array(aggregateRowValidator),
    zones: v.array(aggregateRowValidator),
    teams: v.array(aggregateRowValidator),
    neighbors: v.array(aggregateRowValidator),
    combinations: v.array(aggregateRowValidator),
  }),
});

const historyItemValidator = v.object({
  recordId: v.id("seatChartRecords"),
  recordedAt: v.number(),
  chartName: v.string(),
  layoutName: v.string(),
  deskNumber: v.optional(v.number()),
  zoneName: v.optional(v.string()),
  teamLabel: v.optional(v.string()),
  neighborDisplayNames: v.array(v.string()),
  combinationLabel: v.string(),
});

const recordValidator = v.object({
  _id: v.id("seatChartRecords"),
  recordedAt: v.number(),
  chartName: v.string(),
  layoutName: v.string(),
  canvasWidth: v.number(),
  canvasHeight: v.number(),
  layoutItems: v.array(seatLayoutItemSnapshotValidator),
  placements: v.array(
    v.object({
      studentUserId: v.id("users"),
      studentDisplayName: v.string(),
      deskItemId: v.string(),
      deskNumber: v.optional(v.number()),
      zoneName: v.optional(v.string()),
      teamLabel: v.optional(v.string()),
      neighborDisplayNames: v.array(v.string()),
    }),
  ),
});

async function getOwnedChart(
  ctx: { classDoc: Doc<"classes">; db: QueryCtx["db"] },
  chartId: Id<"seatCharts">,
) {
  const chart = await ctx.db.get("seatCharts", chartId);
  if (!chart || chart.classId !== ctx.classDoc._id) {
    throw new Error("Chart not found");
  }
  return chart;
}

type DraftPlacementSummary = {
  deskItemId: string;
  deskNumber?: number;
  zoneName?: string;
  teamLabel?: string;
  neighborDisplayNames: Array<string>;
  isDraft: true;
};

type CurrentContextCounts = {
  seat?: { count: number; percent: number; label: string };
  zone?: { count: number; percent: number; label: string };
  team?: { count: number; percent: number; label: string };
  neighbors: Array<{
    studentUserId: Id<"users">;
    label: string;
    count: number;
    percent: number;
  }>;
  combination?: { count: number; percent: number; label: string };
};

async function layoutNameForChart(
  ctx: QueryCtx,
  layoutId: Id<"seatLayouts">,
  classId: Id<"classes">,
): Promise<string> {
  const layout = await ctx.db.get("seatLayouts", layoutId);
  if (!layout || layout.classId !== classId) return "Layout";
  return layout.name;
}

async function recordCountForChart(ctx: QueryCtx, chartId: Id<"seatCharts">): Promise<number> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- chart-bounded record list
  const records = await ctx.db
    .query("seatChartRecords")
    .withIndex("by_chart", (q) => q.eq("chartId", chartId))
    .collect();
  return records.length;
}

function percent(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

/**
 * List seating charts for a class (active first, then archived).
 */
export const list = classQuery({
  args: {
    includeArchived: v.optional(v.boolean()),
  },
  returns: v.array(chartListItemValidator),
  handler: async (ctx, args) => {
    await ctx.require("assigners:read");
    const classId = ctx.classDoc._id;
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- class-bounded chart list
    const charts = await ctx.db
      .query("seatCharts")
      .withIndex("by_class", (q) => q.eq("classId", classId))
      .collect();

    const includeArchived = args.includeArchived === true;
    const filtered = includeArchived
      ? charts
      : charts.filter((chart) => chart.archivedAt === undefined);

    const rows = await Promise.all(
      filtered.map(async (chart) => ({
        _id: chart._id,
        _creationTime: chart._creationTime,
        name: chart.name,
        layoutId: chart.layoutId,
        layoutName: await layoutNameForChart(ctx, chart.layoutId, classId),
        updatedAt: chart.updatedAt,
        recordCount: await recordCountForChart(ctx, chart._id),
        seatedCount: chart.assignments.length,
        ...(chart.archivedAt !== undefined ? { archivedAt: chart.archivedAt } : {}),
      })),
    );

    return rows.sort(
      (a, b) =>
        (a.archivedAt !== undefined ? 1 : 0) - (b.archivedAt !== undefined ? 1 : 0) ||
        b.updatedAt - a.updatedAt ||
        b._creationTime - a._creationTime,
    );
  },
});

/**
 * Load a chart with its linked layout geometry for the editor.
 */
export const get = classQuery({
  args: {
    chartId: v.id("seatCharts"),
  },
  returns: chartValidator,
  handler: async (ctx, args) => {
    await ctx.require("assigners:read");
    const chart = await getOwnedChart(ctx, args.chartId);
    const layout = await ctx.db.get("seatLayouts", chart.layoutId);
    if (!layout || layout.classId !== ctx.classDoc._id) {
      throw new Error("Layout not found");
    }

    return {
      _id: chart._id,
      _creationTime: chart._creationTime,
      classId: chart.classId,
      layoutId: chart.layoutId,
      name: chart.name,
      ...(chart.archivedAt !== undefined ? { archivedAt: chart.archivedAt } : {}),
      assignments: chart.assignments,
      updatedAt: chart.updatedAt,
      createdBy: chart.createdBy,
      layout: {
        _id: layout._id,
        name: layout.name,
        canvasWidth: layout.canvasWidth,
        canvasHeight: layout.canvasHeight,
        items: layout.items,
      },
    };
  },
});

/**
 * Create a seating chart for a layout.
 */
export const create = classMutation({
  args: {
    name: v.string(),
    layoutId: v.id("seatLayouts"),
  },
  returns: v.id("seatCharts"),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "seatChartCreate", { key: ctx.userId, throws: true });
    await ctx.require("assigners:manage");

    const classId = ctx.classDoc._id;
    const name = normalizeChartName(args.name);
    const layout = await ctx.db.get("seatLayouts", args.layoutId);
    if (!layout || layout.classId !== classId) {
      throw new Error("Layout not found");
    }

    const now = Date.now();
    const chartId = await ctx.db.insert("seatCharts", {
      classId,
      layoutId: args.layoutId,
      name,
      assignments: [],
      updatedAt: now,
      createdBy: ctx.userId,
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "seatChart",
      resourceId: chartId,
      summary: `Created seating chart "${name}"`,
      summaryKey: "activitySummary_createdSeatChart",
      metadata: { name, layoutName: layout.name },
    });

    return chartId;
  },
});

/**
 * Rename a seating chart.
 */
export const rename = classMutation({
  args: {
    chartId: v.id("seatCharts"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "seatChartRename", { key: ctx.userId, throws: true });
    await ctx.require("assigners:manage");

    const chart = await getOwnedChart(ctx, args.chartId);
    const name = normalizeChartName(args.name);
    await ctx.db.patch("seatCharts", args.chartId, { name, updatedAt: Date.now() });

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "seatChart",
      resourceId: args.chartId,
      summary: `Renamed seating chart to "${name}"`,
      summaryKey: "activitySummary_renamedSeatChart",
      metadata: { name, previousName: chart.name },
    });

    return null;
  },
});

/**
 * Archive a seating chart (records remain viewable).
 */
export const archive = classMutation({
  args: {
    chartId: v.id("seatCharts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "seatChartArchive", { key: ctx.userId, throws: true });
    await ctx.require("assigners:manage");

    const chart = await getOwnedChart(ctx, args.chartId);
    if (chart.archivedAt !== undefined) {
      return null;
    }

    const now = Date.now();
    await ctx.db.patch("seatCharts", args.chartId, { archivedAt: now, updatedAt: now });

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "seatChart",
      resourceId: args.chartId,
      summary: `Archived seating chart "${chart.name}"`,
      summaryKey: "activitySummary_archivedSeatChart",
      metadata: { name: chart.name },
    });

    return null;
  },
});

/**
 * Save draft assignments without recording history.
 */
export const saveDraft = classMutation({
  args: {
    chartId: v.id("seatCharts"),
    assignments: v.array(chartAssignmentValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "seatChartSaveDraft", { key: ctx.userId, throws: true });
    await ctx.require("assigners:manage");

    const chart = await getOwnedChart(ctx, args.chartId);
    if (chart.archivedAt !== undefined) {
      throw new Error("Archived charts cannot be edited");
    }

    const layout = await ctx.db.get("seatLayouts", chart.layoutId);
    if (!layout || layout.classId !== ctx.classDoc._id) {
      throw new Error("Layout not found");
    }

    const deskById = deskItemsById(layout.items);
    const assignments = await normalizeDraftAssignments(
      ctx,
      ctx.classDoc._id,
      args.assignments,
      deskById,
    );
    for (const assignment of assignments) {
      await requireStudentInClass(ctx, ctx.classDoc._id, assignment.studentUserId);
    }

    await ctx.db.patch("seatCharts", args.chartId, {
      assignments,
      updatedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Preview constraint violations for the current draft.
 */
export const previewViolations = classQuery({
  args: {
    chartId: v.id("seatCharts"),
    assignments: v.array(chartAssignmentValidator),
  },
  returns: v.array(violationValidator),
  handler: async (ctx, args) => {
    await ctx.require("assigners:read");
    const chart = await getOwnedChart(ctx, args.chartId);
    const layout = await ctx.db.get("seatLayouts", chart.layoutId);
    if (!layout || layout.classId !== ctx.classDoc._id) {
      throw new Error("Layout not found");
    }

    const deskById = deskItemsById(layout.items);
    const assignments = await normalizeDraftAssignments(
      ctx,
      ctx.classDoc._id,
      args.assignments,
      deskById,
    );
    const nameCache = new Map<Id<"users">, string>();
    for (const assignment of assignments) {
      nameCache.set(
        assignment.studentUserId,
        await resolveStudentDisplayName(ctx, ctx.classDoc, assignment.studentUserId),
      );
    }
    const constraintStudentIds = new Set<Id<"users">>();
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- class-bounded constraints
    const constraints = await ctx.db
      .query("seatConstraints")
      .withIndex("by_class", (q) => q.eq("classId", ctx.classDoc._id))
      .collect();
    for (const constraint of constraints) {
      constraintStudentIds.add(constraint.studentUserId);
      if (constraint.otherStudentUserId) {
        constraintStudentIds.add(constraint.otherStudentUserId);
      }
    }
    for (const studentUserId of constraintStudentIds) {
      if (!nameCache.has(studentUserId)) {
        nameCache.set(
          studentUserId,
          await resolveStudentDisplayName(ctx, ctx.classDoc, studentUserId),
        );
      }
    }

    return evaluateConstraintViolations(
      ctx,
      ctx.classDoc._id,
      layout.items,
      assignments,
      (userId) => nameCache.get(userId) ?? userId,
    );
  },
});

/**
 * Record seating — saves draft and creates immutable history.
 */
export const recordSeating = classMutation({
  args: {
    chartId: v.id("seatCharts"),
    assignments: v.array(chartAssignmentValidator),
  },
  returns: v.id("seatChartRecords"),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "seatChartRecord", { key: ctx.userId, throws: true });
    await ctx.require("assigners:manage");

    const chart = await getOwnedChart(ctx, args.chartId);
    if (chart.archivedAt !== undefined) {
      throw new Error("Archived charts cannot be recorded");
    }

    const layout = await ctx.db.get("seatLayouts", chart.layoutId);
    if (!layout || layout.classId !== ctx.classDoc._id) {
      throw new Error("Layout not found");
    }

    const deskById = deskItemsById(layout.items);
    const assignments = await normalizeDraftAssignments(
      ctx,
      ctx.classDoc._id,
      args.assignments,
      deskById,
    );
    for (const assignment of assignments) {
      await requireStudentInClass(ctx, ctx.classDoc._id, assignment.studentUserId);
    }

    const now = Date.now();
    const placements = await buildPlacementSnapshots(ctx, ctx.classDoc, layout, assignments);

    const recordId = await ctx.db.insert("seatChartRecords", {
      classId: ctx.classDoc._id,
      chartId: args.chartId,
      recordedAt: now,
      recordedBy: ctx.userId,
      chartName: chart.name,
      layoutId: layout._id,
      layoutName: layout.name,
      canvasWidth: layout.canvasWidth,
      canvasHeight: layout.canvasHeight,
      layoutItems: layout.items,
      placedCount: placements.length,
      seatedStudentIds: placements.map((p) => p.studentUserId),
    });

    for (const placement of placements) {
      await ctx.db.insert("seatChartPlacements", {
        classId: ctx.classDoc._id,
        chartId: args.chartId,
        recordId,
        studentUserId: placement.studentUserId,
        studentDisplayName: placement.studentDisplayName,
        deskItemId: placement.deskItemId,
        ...(placement.deskNumber !== undefined ? { deskNumber: placement.deskNumber } : {}),
        ...(placement.zoneName !== undefined ? { zoneName: placement.zoneName } : {}),
        ...(placement.teamKey !== undefined ? { teamKey: placement.teamKey } : {}),
        ...(placement.teamLabel !== undefined ? { teamLabel: placement.teamLabel } : {}),
        neighborStudentIds: placement.neighborStudentIds,
        neighborDisplayNames: placement.neighborDisplayNames,
        combinationKey: placement.combinationKey,
        recordedAt: now,
      });

      await applyPlacementAggregates(ctx, {
        classId: ctx.classDoc._id,
        chartId: args.chartId,
        layoutId: layout._id,
        placement,
        now,
      });
    }

    await ctx.db.patch("seatCharts", args.chartId, {
      assignments,
      updatedAt: now,
    });

    await syncMembershipTeamsFromSeating(ctx, ctx.classDoc._id, layout, assignments);

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "seatChart",
      resourceId: args.chartId,
      summary: `Recorded seating for chart "${chart.name}"`,
      summaryKey: "activitySummary_recordedSeatChart",
      metadata: {
        name: chart.name,
        placedCount: String(placements.length),
      },
    });

    return recordId;
  },
});

/**
 * Load a frozen recorded snapshot.
 */
export const getRecord = classQuery({
  args: {
    recordId: v.id("seatChartRecords"),
  },
  returns: recordValidator,
  handler: async (ctx, args) => {
    await ctx.require("assigners:read");
    const record = await ctx.db.get("seatChartRecords", args.recordId);
    if (!record || record.classId !== ctx.classDoc._id) {
      throw new Error("Record not found");
    }

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- bounded by one record
    const placements = await ctx.db
      .query("seatChartPlacements")
      .withIndex("by_record", (q) => q.eq("recordId", args.recordId))
      .collect();

    return {
      _id: record._id,
      recordedAt: record.recordedAt,
      chartName: record.chartName,
      layoutName: record.layoutName,
      canvasWidth: record.canvasWidth,
      canvasHeight: record.canvasHeight,
      layoutItems: record.layoutItems,
      placements: placements.map((placement) => ({
        studentUserId: placement.studentUserId,
        studentDisplayName: placement.studentDisplayName,
        deskItemId: placement.deskItemId,
        ...(placement.deskNumber !== undefined ? { deskNumber: placement.deskNumber } : {}),
        ...(placement.zoneName !== undefined ? { zoneName: placement.zoneName } : {}),
        ...(placement.teamLabel !== undefined ? { teamLabel: placement.teamLabel } : {}),
        neighborDisplayNames: placement.neighborDisplayNames,
      })),
    };
  },
});

/**
 * Paginated seating history for one student on a chart.
 */
export const studentHistory = classQuery({
  args: {
    chartId: v.id("seatCharts"),
    studentUserId: v.id("users"),
    beforeRecordedAt: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    items: v.array(historyItemValidator),
    nextBeforeRecordedAt: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    await ctx.require("assigners:read");
    await getOwnedChart(ctx, args.chartId);

    const limit = Math.min(
      Math.max(1, Math.floor(args.limit ?? DEFAULT_HISTORY_LIMIT)),
      MAX_HISTORY_LIMIT,
    );

    const query = ctx.db
      .query("seatChartPlacements")
      .withIndex("by_chart_student_recorded", (q) =>
        q.eq("chartId", args.chartId).eq("studentUserId", args.studentUserId),
      )
      .order("desc");

    const rows =
      args.beforeRecordedAt !== undefined
        ? await ctx.db
            .query("seatChartPlacements")
            .withIndex("by_chart_student_recorded", (q) =>
              q
                .eq("chartId", args.chartId)
                .eq("studentUserId", args.studentUserId)
                .lt("recordedAt", args.beforeRecordedAt!),
            )
            .order("desc")
            .take(limit)
        : await query.take(limit);

    const recordCache = new Map<Id<"seatChartRecords">, Doc<"seatChartRecords">>();
    const items = [];
    for (const row of rows) {
      let record = recordCache.get(row.recordId);
      if (!record) {
        const loaded = await ctx.db.get("seatChartRecords", row.recordId);
        if (!loaded) continue;
        record = loaded;
        recordCache.set(row.recordId, loaded);
      }
      items.push({
        recordId: row.recordId,
        recordedAt: row.recordedAt,
        chartName: record.chartName,
        layoutName: record.layoutName,
        ...(row.deskNumber !== undefined ? { deskNumber: row.deskNumber } : {}),
        ...(row.zoneName !== undefined ? { zoneName: row.zoneName } : {}),
        ...(row.teamLabel !== undefined ? { teamLabel: row.teamLabel } : {}),
        neighborDisplayNames: row.neighborDisplayNames,
        combinationLabel: [
          row.deskNumber !== undefined ? `Seat ${row.deskNumber}` : "Seat",
          row.zoneName,
          row.teamLabel,
          row.neighborDisplayNames.length > 0 ? row.neighborDisplayNames.join(", ") : undefined,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }

    const last = rows.at(-1);
    return {
      items,
      ...(rows.length === limit && last ? { nextBeforeRecordedAt: last.recordedAt } : {}),
    };
  },
});

/**
 * Longitudinal statistics for one student on a chart, including draft context.
 */
export const studentSummary = classQuery({
  args: {
    chartId: v.id("seatCharts"),
    studentUserId: v.id("users"),
  },
  returns: studentSummaryValidator,
  handler: async (ctx, args) => {
    await ctx.require("assigners:read");
    const chart = await getOwnedChart(ctx, args.chartId);
    const layout = await ctx.db.get("seatLayouts", chart.layoutId);
    if (!layout || layout.classId !== ctx.classDoc._id) {
      throw new Error("Layout not found");
    }

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- per-student aggregate set
    const aggregates = await ctx.db
      .query("seatChartAggregates")
      .withIndex("by_chart_student", (q) =>
        q.eq("chartId", args.chartId).eq("studentUserId", args.studentUserId),
      )
      .collect();

    const byDimension = (dimension: Doc<"seatChartAggregates">["dimension"]) =>
      aggregates
        .filter((row) => row.dimension === dimension)
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .map((row) => ({
          dimension: row.dimension,
          key: row.key,
          label: row.label,
          count: row.count,
        }));

    const totalRow = aggregates.find((row) => row.dimension === "total");
    const totalRecorded = totalRow?.count ?? 0;

    const draftAssignment = chart.assignments.find((a) => a.studentUserId === args.studentUserId);
    let draftPlacement: DraftPlacementSummary | undefined;
    let currentContextCounts: CurrentContextCounts = {
      neighbors: [],
    };

    if (draftAssignment) {
      const desk = layout.items.find(
        (item) => item.id === draftAssignment.deskItemId && item.kind === "desk",
      );
      if (desk) {
        const deskById = deskItemsById(layout.items);
        const assignments = await normalizeDraftAssignments(
          ctx,
          ctx.classDoc._id,
          chart.assignments,
          deskById,
        );
        const placements = await buildPlacementSnapshots(ctx, ctx.classDoc, layout, assignments);
        const snapshot = placements.find((p) => p.studentUserId === args.studentUserId);
        if (snapshot) {
          draftPlacement = {
            deskItemId: snapshot.deskItemId,
            ...(snapshot.deskNumber !== undefined ? { deskNumber: snapshot.deskNumber } : {}),
            ...(snapshot.zoneName !== undefined ? { zoneName: snapshot.zoneName } : {}),
            ...(snapshot.teamLabel !== undefined ? { teamLabel: snapshot.teamLabel } : {}),
            neighborDisplayNames: snapshot.neighborDisplayNames,
            isDraft: true,
          };

          const seatKey = seatAggregateKey(layout._id, snapshot.deskItemId);
          const seatRow = aggregates.find((row) => row.dimension === "seat" && row.key === seatKey);
          currentContextCounts.seat = {
            count: seatRow?.count ?? 0,
            percent: percent(seatRow?.count ?? 0, totalRecorded),
            label: seatAggregateLabel(snapshot.deskNumber),
          };

          if (snapshot.zoneName) {
            const zoneRow = aggregates.find(
              (row) => row.dimension === "zone" && row.key === snapshot.zoneName,
            );
            currentContextCounts.zone = {
              count: zoneRow?.count ?? 0,
              percent: percent(zoneRow?.count ?? 0, totalRecorded),
              label: snapshot.zoneName,
            };
          }

          if (snapshot.teamKey && snapshot.teamLabel) {
            const teamRow = aggregates.find(
              (row) => row.dimension === "team" && row.key === snapshot.teamKey,
            );
            currentContextCounts.team = {
              count: teamRow?.count ?? 0,
              percent: percent(teamRow?.count ?? 0, totalRecorded),
              label: snapshot.teamLabel,
            };
          }

          currentContextCounts.neighbors = snapshot.neighborStudentIds.map((neighborId, index) => {
            const neighborRow = aggregates.find(
              (row) => row.dimension === "neighbor" && row.key === neighborId,
            );
            const label = snapshot.neighborDisplayNames[index] ?? neighborId;
            return {
              studentUserId: neighborId,
              label,
              count: neighborRow?.count ?? 0,
              percent: percent(neighborRow?.count ?? 0, totalRecorded),
            };
          });

          const comboRow = aggregates.find(
            (row) => row.dimension === "combination" && row.key === snapshot.combinationKey,
          );
          currentContextCounts.combination = {
            count: comboRow?.count ?? 0,
            percent: percent(comboRow?.count ?? 0, totalRecorded),
            label: comboRow?.label ?? snapshot.combinationKey,
          };
        }
      }
    }

    return {
      studentUserId: args.studentUserId,
      totalRecorded,
      ...(draftPlacement !== undefined ? { draftPlacement } : {}),
      currentContextCounts,
      breakdowns: {
        seats: byDimension("seat"),
        zones: byDimension("zone"),
        teams: byDimension("team"),
        neighbors: byDimension("neighbor"),
        combinations: byDimension("combination"),
      },
    };
  },
});
