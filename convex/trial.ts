import { v } from "convex/values";

import { internal } from "./_generated/api.js";
import { internalMutation } from "./_generated/server.js";

const SWEEP_PAGE_SIZE = 100;

/**
 * Flip `expiredAt` when a trial grant reaches `endsAt`.
 * Re-checks the deadline so a rescheduled/extended grant is never wrongly expired.
 */
export const markExpired = internalMutation({
  args: {
    grantId: v.id("trialGrants"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const grant = await ctx.db.get("trialGrants", args.grantId);
    if (!grant) {
      return null;
    }
    if (grant.expiredAt !== undefined) {
      return null;
    }
    const now = Date.now();
    if (grant.endsAt > now) {
      return null;
    }
    await ctx.db.patch("trialGrants", args.grantId, { expiredAt: now });
    return null;
  },
});

/**
 * Safety net for lost per-grant `markExpired` jobs.
 * Pages grants with `endsAt <= now` and sets `expiredAt` when still unset.
 */
export const expireLapsedGrants = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    expired: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    let expired = args.expired ?? 0;

    const page = await ctx.db
      .query("trialGrants")
      .withIndex("by_endsAt", (q) => q.lte("endsAt", now))
      .paginate({
        numItems: SWEEP_PAGE_SIZE,
        cursor: args.cursor ?? null,
      });

    for (const grant of page.page) {
      if (grant.expiredAt !== undefined) {
        continue;
      }
      await ctx.db.patch("trialGrants", grant._id, { expiredAt: now });
      expired += 1;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.trial.expireLapsedGrants, {
        cursor: page.continueCursor,
        expired,
      });
    } else if (expired > 0) {
      console.log("Trial expiry sweep complete", { expired });
    }

    return null;
  },
});
