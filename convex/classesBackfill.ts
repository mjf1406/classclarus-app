import { v } from "convex/values";

import { internalMutation } from "./_generated/server.js";

/**
 * One-time backfill: set `studentLanguage` on classes created before the field existed.
 * Safe to re-run — skips docs that already have a language.
 *
 * `bunx convex run classesBackfill:studentLanguage`
 */
export const studentLanguage = internalMutation({
  args: {},
  returns: v.object({
    patched: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx) => {
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- one-time backfill over bounded class table
    const classes = await ctx.db.query("classes").collect();
    let patched = 0;
    let skipped = 0;

    for (const classDoc of classes) {
      // Pre-schema rows may omit the field even after the required validator lands.
      const existing = (classDoc as { studentLanguage?: string }).studentLanguage;
      if (existing !== undefined) {
        skipped += 1;
        continue;
      }
      await ctx.db.patch("classes", classDoc._id, { studentLanguage: "en" });
      patched += 1;
    }

    return { patched, skipped };
  },
});
