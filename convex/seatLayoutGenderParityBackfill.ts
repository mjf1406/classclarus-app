import { v } from "convex/values";

import { internalMutation } from "./_generated/server.js";
import { resolveLayoutGenderParityMode } from "./lib/seating/settings.js";

const BATCH_SIZE = 50;

/**
 * Copy each class's legacy `seatAlgorithmSettings.genderParity` onto layouts that
 * do not yet have `genderParity`. Falls back to oddEven when no class settings exist
 * (the previous class-level default).
 *
 * Run with cursor=null until isDone, then optionally call purgeLegacySettings.
 */
export const backfillGenderParity = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    processed: v.number(),
    patched: v.number(),
    continueCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("seatLayouts")
      .paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null });

    let processed = 0;
    let patched = 0;
    const classModeCache = new Map<string, "off" | "oddEven">();

    for (const layout of page.page) {
      processed += 1;
      if (layout.genderParity !== undefined) continue;

      const classKey = layout.classId;
      let mode = classModeCache.get(classKey);
      if (mode === undefined) {
        const settings = await ctx.db
          .query("seatAlgorithmSettings")
          .withIndex("by_class", (q) => q.eq("classId", layout.classId))
          .unique();
        mode = resolveLayoutGenderParityMode(settings?.genderParity);
        classModeCache.set(classKey, mode);
      }

      await ctx.db.patch("seatLayouts", layout._id, {
        genderParity: { mode },
      });
      patched += 1;
    }

    return {
      processed,
      patched,
      continueCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
    };
  },
});

/**
 * Delete legacy class-scoped algorithm settings rows after gender parity backfill.
 */
export const purgeLegacySettings = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    deleted: v.number(),
    continueCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("seatAlgorithmSettings")
      .paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null });

    let deleted = 0;
    for (const row of page.page) {
      await ctx.db.delete("seatAlgorithmSettings", row._id);
      deleted += 1;
    }

    return {
      deleted,
      continueCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
    };
  },
});
