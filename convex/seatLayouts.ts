import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import { rateLimiter } from "./lib/rateLimiter.js";

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

const seatLayoutItemValidator = v.object({
  id: v.string(),
  kind: v.union(v.literal("desk"), v.literal("teacherDesk"), v.literal("board"), v.literal("rect")),
  label: v.string(),
  deskNumber: v.optional(v.number()),
  teamAssignment: v.optional(teamAssignmentValidator),
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
  updatedAt: v.number(),
  createdBy: v.id("users"),
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

function normalizeItems(
  items: Array<{
    id: string;
    kind: "desk" | "teacherDesk" | "board" | "rect";
    label: string;
    deskNumber?: number;
    teamAssignment?:
      | { mode: "single"; groupId: Id<"groups">; teamId: Id<"teams"> }
      | { mode: "byName"; teamName: string };
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

    return {
      id,
      kind: item.kind,
      label: normalizeLabel(item.label),
      ...(deskNumber !== undefined ? { deskNumber } : {}),
      ...(teamAssignment !== undefined ? { teamAssignment } : {}),
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
    await ctx.require("assigners:read");
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
 * Get a single seat layout with items.
 */
export const get = classQuery({
  args: {
    layoutId: v.id("seatLayouts"),
  },
  returns: v.union(seatLayoutValidator, v.null()),
  handler: async (ctx, args) => {
    await ctx.require("assigners:read");
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
      updatedAt: layout.updatedAt,
      createdBy: layout.createdBy,
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
