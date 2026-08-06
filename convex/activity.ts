import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

import { internal } from "./_generated/api.js";
import { internalMutation } from "./_generated/server.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import {
  ACTIVITY_PURGE_BATCH_SIZE,
  ACTIVITY_RETENTION_MS,
  deleteActivityBatchForClass,
  hasRecentMatchingActivity,
  recordClassActivity,
  toPublicActivityEvent,
  type ActivityAction,
} from "./lib/classActivity.js";
import { rateLimiter } from "./lib/rateLimiter.js";

const activityActionValidator = v.union(
  v.literal("read"),
  v.literal("write"),
  v.literal("update"),
  v.literal("delete"),
);

const activityEventValidator = v.object({
  _id: v.id("classActivityEvents"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  actorUserId: v.id("users"),
  actorEmail: v.string(),
  actorRole: v.string(),
  action: activityActionValidator,
  resourceType: v.string(),
  resourceId: v.optional(v.string()),
  summary: v.string(),
  metadata: v.optional(v.record(v.string(), v.string())),
  createdAt: v.number(),
});

/**
 * Paginated activity log for a class (newest first). Requires `activity:read`.
 */
export const list = classQuery({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(activityEventValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, args) => {
    await ctx.require("activity:read");
    const result = await ctx.db
      .query("classActivityEvents")
      .withIndex("by_class_createdAt", (q) => q.eq("classId", ctx.classDoc._id))
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      page: result.page.map(toPublicActivityEvent),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

/**
 * Intentional education-record access log (from UI hooks).
 * Deduped within 15 minutes; rate-limited; never throws for duplicate skips.
 */
export const logAccess = classMutation({
  args: {
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    summary: v.string(),
    metadata: v.optional(v.record(v.string(), v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "activityLogAccess", { key: ctx.userId, throws: true });

    const resourceType = args.resourceType.trim().slice(0, 64);
    const summary = args.summary.trim().slice(0, 500);
    if (!resourceType || !summary) {
      return null;
    }

    const resourceId = args.resourceId?.trim().slice(0, 128);
    const duplicate = await hasRecentMatchingActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "read",
      resourceType,
      resourceId,
    });
    if (duplicate) {
      return null;
    }

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "read",
      resourceType,
      ...(resourceId !== undefined && resourceId.length > 0 ? { resourceId } : {}),
      summary,
      ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    });
    return null;
  },
});

/**
 * Record activity from an action (e.g. file byte access). Applies read dedupe.
 */
export const recordFromAction = internalMutation({
  args: {
    classId: v.id("classes"),
    actorUserId: v.id("users"),
    action: activityActionValidator,
    resourceType: v.string(),
    resourceId: v.optional(v.string()),
    summary: v.string(),
    metadata: v.optional(v.record(v.string(), v.string())),
    dedupeRead: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const action = args.action as ActivityAction;
    if (args.dedupeRead && action === "read") {
      const duplicate = await hasRecentMatchingActivity(ctx, {
        classId: args.classId,
        actorUserId: args.actorUserId,
        action,
        resourceType: args.resourceType,
        resourceId: args.resourceId,
      });
      if (duplicate) {
        return null;
      }
    }

    await recordClassActivity(ctx, {
      classId: args.classId,
      actorUserId: args.actorUserId,
      action,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      summary: args.summary,
      metadata: args.metadata,
    });
    return null;
  },
});

/**
 * Delete activity rows for a class in batches (used on class delete).
 */
export const purgeForClass = internalMutation({
  args: {
    classId: v.id("classes"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deleted = await deleteActivityBatchForClass(ctx, args.classId);
    if (deleted >= ACTIVITY_PURGE_BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.activity.purgeForClass, {
        classId: args.classId,
      });
    }
    return null;
  },
});

/**
 * Retention sweep: delete events older than 1 year.
 */
export const purgeExpired = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cutoff = Date.now() - ACTIVITY_RETENTION_MS;
    const page = await ctx.db
      .query("classActivityEvents")
      .withIndex("by_createdAt", (q) => q.lt("createdAt", cutoff))
      .paginate({
        numItems: ACTIVITY_PURGE_BATCH_SIZE,
        cursor: args.cursor ?? null,
      });

    for (const event of page.page) {
      await ctx.db.delete("classActivityEvents", event._id);
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.activity.purgeExpired, {
        cursor: page.continueCursor,
      });
    }
    return null;
  },
});
