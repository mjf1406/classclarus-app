import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { authz } from "./authz.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { classScope } from "./lib/authzModel.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import {
  copySeatAlgorithmSettings,
  DEFAULT_SEAT_ALGORITHM_SETTINGS,
  normalizeSeatAlgorithmSettings,
  seatAlgorithmSettingsDocValidator,
  seatingWeightsValidator,
} from "./lib/seating/settings.js";

export const get = classQuery({
  args: {},
  returns: v.object({
    weights: seatingWeightsValidator,
    genderParity: v.object({
      mode: v.union(v.literal("off"), v.literal("oddEven")),
    }),
    updatedAt: v.optional(v.number()),
  }),
  handler: async (ctx) => {
    // Staff-only (assistant_teacher+); students/guardians cannot view settings.
    await ctx.require("students:read");
    const classId = ctx.classDoc._id;
    const existing = await ctx.db
      .query("seatAlgorithmSettings")
      .withIndex("by_class", (q) => q.eq("classId", classId))
      .unique();

    if (existing) {
      return {
        weights: existing.weights,
        genderParity: existing.genderParity,
        updatedAt: existing.updatedAt,
      };
    }

    return {
      weights: DEFAULT_SEAT_ALGORITHM_SETTINGS.weights,
      genderParity: DEFAULT_SEAT_ALGORITHM_SETTINGS.genderParity,
    };
  },
});

export const update = classMutation({
  args: {
    weights: v.object({
      seat: v.number(),
      zone: v.number(),
      team: v.number(),
      neighbor: v.number(),
      gender: v.number(),
      combination: v.number(),
    }),
    genderParity: v.object({
      mode: v.union(v.literal("off"), v.literal("oddEven")),
    }),
  },
  returns: seatAlgorithmSettingsDocValidator,
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "seatAlgorithmSettingsUpdate", {
      key: ctx.userId,
      throws: true,
    });
    await ctx.require("assigners:manage");

    const classId = ctx.classDoc._id;
    const normalized = normalizeSeatAlgorithmSettings({
      weights: args.weights,
      genderParity: args.genderParity,
    });
    const now = Date.now();

    const existing = await ctx.db
      .query("seatAlgorithmSettings")
      .withIndex("by_class", (q) => q.eq("classId", classId))
      .unique();

    if (existing) {
      await ctx.db.patch("seatAlgorithmSettings", existing._id, {
        weights: normalized.weights,
        genderParity: normalized.genderParity,
        updatedAt: now,
        updatedBy: ctx.userId,
      });
      const updated = await ctx.db.get("seatAlgorithmSettings", existing._id);
      if (!updated) throw new Error("Settings not found");
      await recordClassActivity(ctx, {
        classId,
        actorUserId: ctx.userId,
        action: "update",
        resourceType: "seatAlgorithmSettings",
        resourceId: existing._id,
        summary: "Updated seat auto-assign settings",
        summaryKey: "activitySummary_updatedSeatAlgorithmSettings",
      });
      return updated;
    }

    const settingsId = await ctx.db.insert("seatAlgorithmSettings", {
      classId,
      weights: normalized.weights,
      genderParity: normalized.genderParity,
      updatedAt: now,
      updatedBy: ctx.userId,
    });
    const created = await ctx.db.get("seatAlgorithmSettings", settingsId);
    if (!created) throw new Error("Settings not found");
    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "seatAlgorithmSettings",
      resourceId: settingsId,
      summary: "Created seat auto-assign settings",
      summaryKey: "activitySummary_updatedSeatAlgorithmSettings",
    });
    return created;
  },
});

export const importFromClass = classMutation({
  args: {
    sourceClassId: v.id("classes"),
  },
  returns: seatAlgorithmSettingsDocValidator,
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "seatAlgorithmSettingsImport", {
      key: ctx.userId,
      throws: true,
    });
    await ctx.require("assigners:manage");

    const targetClassId = ctx.classDoc._id;
    if (args.sourceClassId === targetClassId) {
      throw new Error("Choose a different class to import from");
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

    const sourceSettings = await ctx.db
      .query("seatAlgorithmSettings")
      .withIndex("by_class", (q) => q.eq("classId", args.sourceClassId))
      .unique();

    const copied = copySeatAlgorithmSettings(
      sourceSettings
        ? normalizeSeatAlgorithmSettings(sourceSettings)
        : DEFAULT_SEAT_ALGORITHM_SETTINGS,
    );
    const now = Date.now();

    const existing = await ctx.db
      .query("seatAlgorithmSettings")
      .withIndex("by_class", (q) => q.eq("classId", targetClassId))
      .unique();

    if (existing) {
      await ctx.db.patch("seatAlgorithmSettings", existing._id, {
        weights: copied.weights,
        genderParity: copied.genderParity,
        updatedAt: now,
        updatedBy: ctx.userId,
      });
      const updated = await ctx.db.get("seatAlgorithmSettings", existing._id);
      if (!updated) throw new Error("Settings not found");
      await recordClassActivity(ctx, {
        classId: targetClassId,
        actorUserId: ctx.userId,
        action: "update",
        resourceType: "seatAlgorithmSettings",
        resourceId: existing._id,
        summary: `Imported seat auto-assign settings from "${sourceClass.name}"`,
        summaryKey: "activitySummary_importedSeatAlgorithmSettings",
        metadata: { sourceClassName: sourceClass.name },
      });
      return updated;
    }

    const settingsId = await ctx.db.insert("seatAlgorithmSettings", {
      classId: targetClassId,
      weights: copied.weights,
      genderParity: copied.genderParity,
      updatedAt: now,
      updatedBy: ctx.userId,
    });
    const created = await ctx.db.get("seatAlgorithmSettings", settingsId);
    if (!created) throw new Error("Settings not found");
    await recordClassActivity(ctx, {
      classId: targetClassId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "seatAlgorithmSettings",
      resourceId: settingsId,
      summary: `Imported seat auto-assign settings from "${sourceClass.name}"`,
      summaryKey: "activitySummary_importedSeatAlgorithmSettings",
      metadata: { sourceClassName: sourceClass.name },
    });
    return created;
  },
});

export async function loadSeatAlgorithmSettingsForClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
) {
  const existing = await ctx.db
    .query("seatAlgorithmSettings")
    .withIndex("by_class", (q) => q.eq("classId", classId))
    .unique();
  return normalizeSeatAlgorithmSettings(existing ?? undefined);
}
