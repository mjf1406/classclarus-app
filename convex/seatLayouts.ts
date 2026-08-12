import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

import { APP_CONFIG } from "./appConfig.js";
import { authz } from "./authz.js";
import { components } from "./_generated/api.js";
import type { Doc, Id } from "./_generated/dataModel.js";
import type { QueryCtx } from "./_generated/server.js";
import { classScope } from "./lib/authzModel.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import { activeChartsForLayout, resolveTeamLabelForDesk } from "./lib/seatChartLogic.js";
import { copySeatLayoutItems } from "./lib/seatLayoutCopy.js";
import {
  buildSeatLayoutRosterMatrixCounts,
  layoutValuesForSeat,
  layoutValuesForZone,
  mergeMatrixValues,
  type SeatLayoutMatrixDimension,
  type SeatLayoutMatrixValue,
  valuesFromAggregateLabels,
} from "./lib/seating/layoutRosterMatrix.js";
import { resolveLayoutGenderParityMode } from "./lib/seating/settings.js";
import { resolveUserImageUrl } from "./lib/userImage.js";

const MAX_LAYOUT_NAME_LENGTH = 80;
const MAX_ITEM_LABEL_LENGTH = 80;
const MAX_ITEMS = 200;
const DEFAULT_CANVAS_WIDTH = 500;
const DEFAULT_CANVAS_HEIGHT = 500;
const MIN_CANVAS = 200;
const MAX_CANVAS = 4000;
const MIN_ITEM_SIZE = 24;
const MAX_ITEM_SIZE = 800;

const teamAssignmentValidator = v.union(
  v.object({
    mode: v.literal("single"),
    groupId: v.id("groups"),
    teamId: v.id("teams"),
  }),
  v.object({
    mode: v.literal("byName"),
    teamName: v.string(),
  }),
);

const genderParityModeValidator = v.union(v.literal("off"), v.literal("oddEven"));

const genderParityValidator = v.object({
  mode: genderParityModeValidator,
});

const seatLayoutItemValidator = v.object({
  id: v.string(),
  kind: v.union(v.literal("desk"), v.literal("teacherDesk"), v.literal("board"), v.literal("rect")),
  label: v.string(),
  deskNumber: v.optional(v.number()),
  teamAssignment: v.optional(teamAssignmentValidator),
  zoneName: v.optional(v.string()),
  x: v.number(),
  y: v.number(),
  width: v.number(),
  height: v.number(),
});

const seatLayoutListItemValidator = v.object({
  _id: v.id("seatLayouts"),
  _creationTime: v.number(),
  name: v.string(),
  updatedAt: v.number(),
  deskCount: v.number(),
  itemCount: v.number(),
});

const seatLayoutValidator = v.object({
  _id: v.id("seatLayouts"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  name: v.string(),
  canvasWidth: v.number(),
  canvasHeight: v.number(),
  nextDeskNumber: v.number(),
  items: v.array(seatLayoutItemValidator),
  genderParity: genderParityValidator,
  updatedAt: v.number(),
  createdBy: v.id("users"),
});

const algorithmHistoryRowValidator = v.object({
  studentUserId: v.id("users"),
  dimension: v.union(
    v.literal("seat"),
    v.literal("zone"),
    v.literal("team"),
    v.literal("neighbor"),
  ),
  key: v.string(),
  count: v.number(),
});

const seatLayoutMatrixDimensionValidator = v.union(
  v.literal("seat"),
  v.literal("zone"),
  v.literal("team"),
  v.literal("neighbor"),
);

const rosterMatrixStudentValidator = v.object({
  userId: v.id("users"),
  rosterNumber: v.number(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  email: v.optional(v.string()),
  gender: v.optional(
    v.union(
      v.literal("male"),
      v.literal("female"),
      v.literal("transMale"),
      v.literal("transFemale"),
      v.literal("nonBinary"),
      v.literal("selfDescribe"),
      v.literal("preferNotToSay"),
    ),
  ),
  genderSelfDescribe: v.optional(v.string()),
  pronouns: v.optional(
    v.union(
      v.literal("heHim"),
      v.literal("sheHer"),
      v.literal("theyThem"),
      v.literal("heThey"),
      v.literal("sheThey"),
      v.literal("useNameOnly"),
      v.literal("askSelfDescribe"),
      v.literal("preferNotToSay"),
    ),
  ),
  pronounsSelfDescribe: v.optional(v.string()),
  role: v.literal("student"),
});

const seatLayoutMatrixValueValidator = v.object({
  key: v.string(),
  label: v.string(),
});

const seatLayoutMatrixCountValidator = v.object({
  key: v.string(),
  count: v.number(),
});

const seatLayoutMatrixRowValidator = v.object({
  studentUserId: v.id("users"),
  counts: v.array(seatLayoutMatrixCountValidator),
});

const seatLayoutRosterMatrixValidator = v.object({
  layout: v.object({
    _id: v.id("seatLayouts"),
    name: v.string(),
  }),
  dimension: seatLayoutMatrixDimensionValidator,
  values: v.array(seatLayoutMatrixValueValidator),
  students: v.array(rosterMatrixStudentValidator),
  countsByStudent: v.array(seatLayoutMatrixRowValidator),
});

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Name is required");
  }
  if (trimmed.length > MAX_LAYOUT_NAME_LENGTH) {
    throw new Error(`Name must be at most ${MAX_LAYOUT_NAME_LENGTH} characters`);
  }
  return trimmed;
}

async function listStudentUserIds(
  ctx: QueryCtx,
  classId: Id<"classes">,
): Promise<Array<Id<"users">>> {
  const users = await ctx.runQuery(components.authz.queries.getUsersWithRole, {
    tenantId: APP_CONFIG.authzTenantId,
    role: "student",
    scope: classScope(classId),
  });
  return users.map((entry: { userId: string }) => entry.userId as Id<"users">);
}

async function loadRosterStudentsForMatrix(ctx: QueryCtx, classId: Id<"classes">) {
  const studentUserIds = await listStudentUserIds(ctx, classId);
  const studentSet = new Set(studentUserIds);

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded roster
  const rosterRows = await ctx.db
    .query("studentRosters")
    .withIndex("by_classId_rosterNumber", (q) => q.eq("classId", classId))
    .collect();

  const students: Array<{
    userId: Id<"users">;
    rosterNumber: number;
    firstName?: string;
    lastName?: string;
    name?: string;
    image?: string;
    email?: string;
    gender?: Doc<"studentRosters">["gender"];
    genderSelfDescribe?: string;
    pronouns?: Doc<"studentRosters">["pronouns"];
    pronounsSelfDescribe?: string;
    role: "student";
  }> = [];

  for (const row of rosterRows) {
    if (!studentSet.has(row.userId)) continue;
    const user = await ctx.db.get("users", row.userId);
    if (!user) continue;
    students.push({
      userId: row.userId,
      rosterNumber: row.rosterNumber,
      firstName: row.firstName,
      lastName: row.lastName,
      name: user.name,
      image: await resolveUserImageUrl(ctx, user),
      email: user.email,
      gender: row.gender,
      genderSelfDescribe: row.genderSelfDescribe,
      pronouns: row.pronouns,
      pronounsSelfDescribe: row.pronounsSelfDescribe,
      role: "student",
    });
  }

  students.sort((a, b) => a.rosterNumber - b.rosterNumber);
  return students;
}

async function layoutValuesForTeam(
  ctx: QueryCtx,
  layout: Doc<"seatLayouts">,
): Promise<SeatLayoutMatrixValue[]> {
  const values = new Map<string, string>();
  for (const item of layout.items) {
    if (item.kind !== "desk") continue;
    const resolved = await resolveTeamLabelForDesk(ctx, item);
    if (resolved.teamKey && resolved.teamLabel) {
      values.set(resolved.teamKey, resolved.teamLabel);
    }
  }
  return [...values.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

async function deriveMatrixValues(
  ctx: QueryCtx,
  layout: Doc<"seatLayouts">,
  dimension: SeatLayoutMatrixDimension,
  aggregateLabels: Array<Pick<Doc<"seatLayoutAggregates">, "key" | "label">>,
): Promise<SeatLayoutMatrixValue[]> {
  if (dimension === "neighbor") {
    return valuesFromAggregateLabels(aggregateLabels);
  }
  if (dimension === "seat") {
    return mergeMatrixValues(layoutValuesForSeat(layout), aggregateLabels);
  }
  if (dimension === "zone") {
    return mergeMatrixValues(layoutValuesForZone(layout), aggregateLabels);
  }
  return mergeMatrixValues(await layoutValuesForTeam(ctx, layout), aggregateLabels);
}

function normalizeLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length > MAX_ITEM_LABEL_LENGTH) {
    throw new Error(`Label must be at most ${MAX_ITEM_LABEL_LENGTH} characters`);
  }
  return trimmed;
}

function normalizeCanvasSize(value: number, field: string): number {
  if (!Number.isFinite(value) || value < MIN_CANVAS || value > MAX_CANVAS) {
    throw new Error(`${field} must be between ${MIN_CANVAS} and ${MAX_CANVAS}`);
  }
  return Math.round(value);
}

function normalizeZoneName(zoneName: string | undefined): string | undefined {
  if (zoneName === undefined) return undefined;
  const trimmed = zoneName.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_ITEM_LABEL_LENGTH) {
    throw new Error(`Zone name must be at most ${MAX_ITEM_LABEL_LENGTH} characters`);
  }
  return trimmed;
}

function normalizeItems(
  items: Array<{
    id: string;
    kind: "desk" | "teacherDesk" | "board" | "rect";
    label: string;
    deskNumber?: number;
    teamAssignment?:
      | { mode: "single"; groupId: Id<"groups">; teamId: Id<"teams"> }
      | { mode: "byName"; teamName: string };
    zoneName?: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>,
) {
  if (items.length > MAX_ITEMS) {
    throw new Error(`At most ${MAX_ITEMS} items allowed`);
  }
  const seen = new Set<string>();
  return items.map((item) => {
    const id = item.id.trim();
    if (!id || id.length > 64) {
      throw new Error("Invalid item id");
    }
    if (seen.has(id)) {
      throw new Error("Duplicate item id");
    }
    seen.add(id);

    if (
      !Number.isFinite(item.x) ||
      !Number.isFinite(item.y) ||
      !Number.isFinite(item.width) ||
      !Number.isFinite(item.height)
    ) {
      throw new Error("Invalid item geometry");
    }
    if (
      item.width < MIN_ITEM_SIZE ||
      item.height < MIN_ITEM_SIZE ||
      item.width > MAX_ITEM_SIZE ||
      item.height > MAX_ITEM_SIZE
    ) {
      throw new Error(`Item size must be between ${MIN_ITEM_SIZE} and ${MAX_ITEM_SIZE} pixels`);
    }

    let deskNumber: number | undefined;
    if (item.kind === "desk") {
      if (
        item.deskNumber === undefined ||
        !Number.isInteger(item.deskNumber) ||
        item.deskNumber < 1
      ) {
        throw new Error("Desk number is required");
      }
      deskNumber = item.deskNumber;
    }

    let teamAssignment:
      | { mode: "single"; groupId: Id<"groups">; teamId: Id<"teams"> }
      | { mode: "byName"; teamName: string }
      | undefined;
    if (item.kind === "desk" && item.teamAssignment) {
      if (item.teamAssignment.mode === "single") {
        teamAssignment = {
          mode: "single",
          groupId: item.teamAssignment.groupId,
          teamId: item.teamAssignment.teamId,
        };
      } else {
        const teamName = item.teamAssignment.teamName.trim();
        if (!teamName) {
          throw new Error("Team name is required");
        }
        if (teamName.length > MAX_ITEM_LABEL_LENGTH) {
          throw new Error("Team name is too long");
        }
        teamAssignment = { mode: "byName", teamName };
      }
    }

    const zoneName = item.kind === "desk" ? normalizeZoneName(item.zoneName) : undefined;

    return {
      id,
      kind: item.kind,
      label: normalizeLabel(item.label),
      ...(deskNumber !== undefined ? { deskNumber } : {}),
      ...(teamAssignment !== undefined ? { teamAssignment } : {}),
      ...(zoneName !== undefined ? { zoneName } : {}),
      x: Math.round(item.x),
      y: Math.round(item.y),
      width: Math.round(item.width),
      height: Math.round(item.height),
    };
  });
}

/**
 * List seat layouts for a class (summary rows).
 */
export const list = classQuery({
  args: {},
  returns: v.array(seatLayoutListItemValidator),
  handler: async (ctx) => {
    const classId = ctx.classDoc._id;
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- class-bounded layout list
    const docs = await ctx.db
      .query("seatLayouts")
      .withIndex("by_class", (q) => q.eq("classId", classId))
      .collect();

    return docs
      .map((doc) => ({
        _id: doc._id,
        _creationTime: doc._creationTime,
        name: doc.name,
        updatedAt: doc.updatedAt,
        deskCount: doc.items.filter((item) => item.kind === "desk").length,
        itemCount: doc.items.length,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
  },
});

/**
 * Unique trimmed zone names from all seat layouts in the class.
 */
export const listZoneNames = classQuery({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const classId = ctx.classDoc._id;
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- class-bounded layout list
    const docs = await ctx.db
      .query("seatLayouts")
      .withIndex("by_class", (q) => q.eq("classId", classId))
      .collect();

    const names = new Set<string>();
    for (const doc of docs) {
      for (const item of doc.items) {
        if (item.kind !== "desk") continue;
        const zoneName = normalizeZoneName(item.zoneName);
        if (zoneName) names.add(zoneName);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  },
});

/**
 * Get a single seat layout with items.
 */
export const get = classQuery({
  args: {
    layoutId: v.id("seatLayouts"),
  },
  returns: v.union(seatLayoutValidator, v.null()),
  handler: async (ctx, args) => {
    const layout = await ctx.db.get("seatLayouts", args.layoutId);
    if (!layout || layout.classId !== ctx.classDoc._id) {
      return null;
    }
    return {
      _id: layout._id,
      _creationTime: layout._creationTime,
      classId: layout.classId,
      name: layout.name,
      canvasWidth: layout.canvasWidth,
      canvasHeight: layout.canvasHeight,
      nextDeskNumber: layout.nextDeskNumber,
      items: layout.items,
      genderParity: { mode: resolveLayoutGenderParityMode(layout.genderParity) },
      updatedAt: layout.updatedAt,
      createdBy: layout.createdBy,
    };
  },
});

/** Recorded per-layout fairness history used by client-side auto-assignment. */
export const getAlgorithmHistory = classQuery({
  args: {
    layoutId: v.id("seatLayouts"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(algorithmHistoryRowValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await ctx.require("assigners:manage");
    const layout = await ctx.db.get("seatLayouts", args.layoutId);
    if (!layout || layout.classId !== ctx.classDoc._id) {
      throw new Error("Layout not found");
    }

    const result = await ctx.db
      .query("seatLayoutAggregates")
      .withIndex("by_layout", (q) => q.eq("layoutId", args.layoutId))
      .paginate(args.paginationOpts);
    return {
      isDone: result.isDone,
      continueCursor: result.continueCursor,
      page: result.page.flatMap((row) => {
        if (
          row.dimension !== "seat" &&
          row.dimension !== "zone" &&
          row.dimension !== "team" &&
          row.dimension !== "neighbor"
        ) {
          return [];
        }
        return [
          {
            studentUserId: row.studentUserId,
            dimension: row.dimension,
            key: row.key,
            count: row.count,
          },
        ];
      }),
    };
  },
});

/** Per-student seating history matrix for one layout dimension (staff data tab). */
export const rosterMatrix = classQuery({
  args: {
    layoutId: v.id("seatLayouts"),
    dimension: seatLayoutMatrixDimensionValidator,
  },
  returns: seatLayoutRosterMatrixValidator,
  handler: async (ctx, args) => {
    await ctx.require("assigners:manage");
    const layout = await ctx.db.get("seatLayouts", args.layoutId);
    if (!layout || layout.classId !== ctx.classDoc._id) {
      throw new Error("Layout not found");
    }

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- dimension-scoped layout history
    const aggregateRows = await ctx.db
      .query("seatLayoutAggregates")
      .withIndex("by_layout_dimension", (q) =>
        q.eq("layoutId", args.layoutId).eq("dimension", args.dimension),
      )
      .collect();

    const aggregateLabels = aggregateRows.map((row) => ({
      key: row.key,
      label: row.label,
    }));
    const values = await deriveMatrixValues(ctx, layout, args.dimension, aggregateLabels);
    const students = await loadRosterStudentsForMatrix(ctx, ctx.classDoc._id);
    const countsByStudent = buildSeatLayoutRosterMatrixCounts(
      values,
      students.map((student) => student.userId),
      aggregateRows.map((row) => ({
        studentUserId: row.studentUserId,
        key: row.key,
        count: row.count,
      })),
    );

    return {
      layout: {
        _id: layout._id,
        name: layout.name,
      },
      dimension: args.dimension,
      values,
      students,
      countsByStudent,
    };
  },
});

/**
 * Create an empty named seat layout.
 */
export const create = classMutation({
  args: {
    name: v.string(),
  },
  returns: v.id("seatLayouts"),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "seatLayoutCreate", { key: ctx.userId, throws: true });
    await ctx.require("assigners:manage");

    const name = normalizeName(args.name);
    const classId = ctx.classDoc._id;
    const existing = await ctx.db
      .query("seatLayouts")
      .withIndex("by_class_and_name", (q) => q.eq("classId", classId).eq("name", name))
      .unique();
    if (existing) {
      throw new ConvexError({
        code: "SEAT_LAYOUT_NAME_TAKEN",
        message: "A layout with this name already exists",
      });
    }

    const now = Date.now();
    const layoutId = await ctx.db.insert("seatLayouts", {
      classId,
      name,
      canvasWidth: DEFAULT_CANVAS_WIDTH,
      canvasHeight: DEFAULT_CANVAS_HEIGHT,
      nextDeskNumber: 1,
      items: [],
      genderParity: { mode: "off" },
      updatedAt: now,
      createdBy: ctx.userId,
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "seatLayout",
      resourceId: layoutId,
      summary: `Created seat layout "${name}"`,
      summaryKey: "activitySummary_createdSeatLayout",
      metadata: { name },
    });

    return layoutId;
  },
});

/**
 * Copy a seat layout from a class the caller can view into this class.
 */
export const copyFromLayout = classMutation({
  args: {
    name: v.string(),
    sourceClassId: v.id("classes"),
    sourceLayoutId: v.id("seatLayouts"),
  },
  returns: v.id("seatLayouts"),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "seatLayoutCreate", { key: ctx.userId, throws: true });
    await ctx.require("assigners:manage");

    const name = normalizeName(args.name);
    const targetClassId = ctx.classDoc._id;
    const existing = await ctx.db
      .query("seatLayouts")
      .withIndex("by_class_and_name", (q) => q.eq("classId", targetClassId).eq("name", name))
      .unique();
    if (existing) {
      throw new ConvexError({
        code: "SEAT_LAYOUT_NAME_TAKEN",
        message: "A layout with this name already exists",
      });
    }

    const sourceClass = await ctx.db.get("classes", args.sourceClassId);
    if (!sourceClass || sourceClass.archivedAt !== undefined) {
      throw new ConvexError({
        code: "CLASS_UNAVAILABLE",
        message: "Class not found or access denied",
      });
    }

    const canReadSource = await authz.can(
      ctx,
      ctx.userId,
      "class:read",
      classScope(args.sourceClassId),
    );
    if (!canReadSource) {
      throw new ConvexError({
        code: "CLASS_UNAVAILABLE",
        message: "Class not found or access denied",
      });
    }

    const sourceLayout = await ctx.db.get("seatLayouts", args.sourceLayoutId);
    if (!sourceLayout || sourceLayout.classId !== args.sourceClassId) {
      throw new Error("Layout not found");
    }

    const sameClass = args.sourceClassId === targetClassId;
    const items = normalizeItems(
      copySeatLayoutItems(sourceLayout.items, {
        preserveSingleTeamAssignments: sameClass,
      }),
    );

    const now = Date.now();
    const layoutId = await ctx.db.insert("seatLayouts", {
      classId: targetClassId,
      name,
      canvasWidth: sourceLayout.canvasWidth,
      canvasHeight: sourceLayout.canvasHeight,
      nextDeskNumber: sourceLayout.nextDeskNumber,
      items,
      genderParity: { mode: resolveLayoutGenderParityMode(sourceLayout.genderParity) },
      updatedAt: now,
      createdBy: ctx.userId,
    });

    await recordClassActivity(ctx, {
      classId: targetClassId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "seatLayout",
      resourceId: layoutId,
      summary: `Copied seat layout "${name}" from "${sourceClass.name}"`,
      summaryKey: "activitySummary_copiedSeatLayout",
      metadata: { name, sourceClass: sourceClass.name },
    });

    return layoutId;
  },
});

/**
 * Rename a seat layout.
 */
export const rename = classMutation({
  args: {
    layoutId: v.id("seatLayouts"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "seatLayoutRename", { key: ctx.userId, throws: true });
    await ctx.require("assigners:manage");

    const layout = await ctx.db.get("seatLayouts", args.layoutId);
    if (!layout || layout.classId !== ctx.classDoc._id) {
      throw new Error("Layout not found");
    }

    const name = normalizeName(args.name);
    if (name !== layout.name) {
      const existing = await ctx.db
        .query("seatLayouts")
        .withIndex("by_class_and_name", (q) => q.eq("classId", ctx.classDoc._id).eq("name", name))
        .unique();
      if (existing) {
        throw new ConvexError({
          code: "SEAT_LAYOUT_NAME_TAKEN",
          message: "A layout with this name already exists",
        });
      }
    }

    const now = Date.now();
    await ctx.db.patch("seatLayouts", args.layoutId, {
      name,
      updatedAt: now,
    });

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "seatLayout",
      resourceId: args.layoutId,
      summary: `Renamed seat layout to "${name}"`,
      summaryKey: "activitySummary_renamedSeatLayout",
      metadata: { name, previousName: layout.name },
    });

    return null;
  },
});

/**
 * Delete a seat layout.
 */
export const remove = classMutation({
  args: {
    layoutId: v.id("seatLayouts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "seatLayoutRemove", { key: ctx.userId, throws: true });
    await ctx.require("assigners:manage");

    const layout = await ctx.db.get("seatLayouts", args.layoutId);
    if (!layout || layout.classId !== ctx.classDoc._id) {
      throw new Error("Layout not found");
    }

    const activeCharts = await activeChartsForLayout(ctx, args.layoutId);
    if (activeCharts.length > 0) {
      throw new Error("Remove seating charts that use this layout first");
    }

    await ctx.db.delete("seatLayouts", args.layoutId);

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "seatLayout",
      resourceId: args.layoutId,
      summary: `Deleted seat layout "${layout.name}"`,
      summaryKey: "activitySummary_deletedSeatLayout",
      metadata: { name: layout.name },
    });

    return null;
  },
});

/**
 * Update layout-level auto-assign settings (gender parity).
 * Separate from saveItems so canvas edits stay unlogged / high-frequency.
 */
export const updateSettings = classMutation({
  args: {
    layoutId: v.id("seatLayouts"),
    genderParity: genderParityValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "seatLayoutUpdateSettings", { key: ctx.userId, throws: true });
    await ctx.require("assigners:manage");

    const layout = await ctx.db.get("seatLayouts", args.layoutId);
    if (!layout || layout.classId !== ctx.classDoc._id) {
      throw new Error("Layout not found");
    }

    const mode = args.genderParity.mode === "off" ? "off" : "oddEven";
    const now = Date.now();
    await ctx.db.patch("seatLayouts", args.layoutId, {
      genderParity: { mode },
      updatedAt: now,
    });

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "seatLayout",
      resourceId: args.layoutId,
      summary: `Updated gender parity on seat layout "${layout.name}" to ${mode}`,
      summaryKey: "activitySummary_updatedSeatLayoutGenderParity",
      metadata: { name: layout.name, mode },
    });

    return null;
  },
});

/**
 * Replace layout items / canvas size / next desk number (debounced from client).
 * Does not activity-log (high-frequency canvas edits).
 */
export const saveItems = classMutation({
  args: {
    layoutId: v.id("seatLayouts"),
    canvasWidth: v.number(),
    canvasHeight: v.number(),
    nextDeskNumber: v.number(),
    items: v.array(seatLayoutItemValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "seatLayoutSaveItems", { key: ctx.userId, throws: true });
    await ctx.require("assigners:manage");

    const layout = await ctx.db.get("seatLayouts", args.layoutId);
    if (!layout || layout.classId !== ctx.classDoc._id) {
      throw new Error("Layout not found");
    }

    if (
      !Number.isInteger(args.nextDeskNumber) ||
      args.nextDeskNumber < 1 ||
      args.nextDeskNumber > 10_000
    ) {
      throw new Error("Invalid next desk number");
    }

    const items = normalizeItems(args.items);
    const canvasWidth = normalizeCanvasSize(args.canvasWidth, "Canvas width");
    const canvasHeight = normalizeCanvasSize(args.canvasHeight, "Canvas height");

    await ctx.db.patch("seatLayouts", args.layoutId, {
      canvasWidth,
      canvasHeight,
      nextDeskNumber: args.nextDeskNumber,
      items,
      updatedAt: Date.now(),
    });

    return null;
  },
});
