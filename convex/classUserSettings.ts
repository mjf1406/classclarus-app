import { v } from "convex/values";

import { classMutation, classQuery } from "./lib/customFunctions.js";
import { rateLimiter } from "./lib/rateLimiter.js";

const studentsViewModeValidator = v.union(v.literal("grid"), v.literal("table"));

const classUserSettingsValidator = v.object({
  studentsViewMode: v.optional(studentsViewModeValidator),
  studentsColumnOrder: v.optional(v.array(v.string())),
  studentsColumnVisibility: v.optional(v.record(v.string(), v.boolean())),
});

/**
 * Current user's class-scoped UI prefs (students roster view).
 */
export const get = classQuery({
  args: {},
  returns: v.union(classUserSettingsValidator, v.null()),
  handler: async (ctx) => {
    await ctx.require("students:read");
    const row = await ctx.db
      .query("classUserSettings")
      .withIndex("by_userId_classId", (q) =>
        q.eq("userId", ctx.userId).eq("classId", ctx.classDoc._id),
      )
      .unique();
    if (!row) return null;
    return {
      studentsViewMode: row.studentsViewMode,
      studentsColumnOrder: row.studentsColumnOrder,
      studentsColumnVisibility: row.studentsColumnVisibility,
    };
  },
});

/**
 * Upsert students roster view preferences for the current user in this class.
 */
export const upsertStudentsView = classMutation({
  args: {
    studentsViewMode: v.optional(studentsViewModeValidator),
    studentsColumnOrder: v.optional(v.array(v.string())),
    studentsColumnVisibility: v.optional(v.record(v.string(), v.boolean())),
  },
  returns: classUserSettingsValidator,
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "classUserSettingsUpsert", { key: ctx.userId, throws: true });
    await ctx.require("students:read");

    const existing = await ctx.db
      .query("classUserSettings")
      .withIndex("by_userId_classId", (q) =>
        q.eq("userId", ctx.userId).eq("classId", ctx.classDoc._id),
      )
      .unique();

    const patch = {
      ...(args.studentsViewMode !== undefined ? { studentsViewMode: args.studentsViewMode } : {}),
      ...(args.studentsColumnOrder !== undefined
        ? { studentsColumnOrder: args.studentsColumnOrder }
        : {}),
      ...(args.studentsColumnVisibility !== undefined
        ? { studentsColumnVisibility: args.studentsColumnVisibility }
        : {}),
    };

    if (existing) {
      await ctx.db.patch("classUserSettings", existing._id, patch);
      const updated = await ctx.db.get("classUserSettings", existing._id);
      if (!updated) {
        throw new Error("Failed to update class user settings");
      }
      return {
        studentsViewMode: updated.studentsViewMode,
        studentsColumnOrder: updated.studentsColumnOrder,
        studentsColumnVisibility: updated.studentsColumnVisibility,
      };
    }

    const id = await ctx.db.insert("classUserSettings", {
      userId: ctx.userId,
      classId: ctx.classDoc._id,
      ...patch,
    });
    const created = await ctx.db.get("classUserSettings", id);
    if (!created) {
      throw new Error("Failed to create class user settings");
    }
    return {
      studentsViewMode: created.studentsViewMode,
      studentsColumnOrder: created.studentsColumnOrder,
      studentsColumnVisibility: created.studentsColumnVisibility,
    };
  },
});
