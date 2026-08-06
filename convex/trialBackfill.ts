import { v } from "convex/values";

import { internalMutation } from "./_generated/server.js";
import type { Doc, Id } from "./_generated/dataModel.js";
import { claimTrialGrant, normalizeEmail, scheduleTrialExpiry } from "./lib/trial.js";

/**
 * Recompute trial grant emailKeys after NFKC normalization changes,
 * merge collisions onto the earliest grant, and claim missing grants
 * for existing users so entitlement checks do not lock them out.
 *
 * Run once after deploying the normalizeEmail change:
 *   bunx convex run trialBackfill:normalizeEmailKeys
 */
export const normalizeEmailKeys = internalMutation({
  args: {},
  returns: v.object({
    updated: v.number(),
    merged: v.number(),
    claimed: v.number(),
  }),
  handler: async (ctx) => {
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- one-shot backfill
    const grants = await ctx.db.query("trialGrants").collect();
    let updated = 0;

    for (const grant of grants) {
      const recomputed = normalizeEmail(grant.emailKey);
      if (recomputed && recomputed !== grant.emailKey) {
        await ctx.db.patch("trialGrants", grant._id, { emailKey: recomputed });
        updated += 1;
      }
    }

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- one-shot backfill
    const afterUpdate = await ctx.db.query("trialGrants").collect();
    const grouped = new Map<string, Array<Doc<"trialGrants">>>();
    for (const grant of afterUpdate) {
      const list = grouped.get(grant.emailKey) ?? [];
      list.push(grant);
      grouped.set(grant.emailKey, list);
    }

    let merged = 0;
    for (const [, rows] of grouped) {
      if (rows.length < 2) continue;
      rows.sort((a, b) => a.startedAt - b.startedAt);
      const keep = rows[0]!;
      const earliestEnds = Math.min(...rows.map((row) => row.endsAt));
      if (keep.endsAt !== earliestEnds) {
        await ctx.db.patch("trialGrants", keep._id, { endsAt: earliestEnds });
      }
      for (const duplicate of rows.slice(1)) {
        await ctx.db.delete("trialGrants", duplicate._id);
        merged += 1;
      }
    }

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- one-shot backfill
    const users = await ctx.db.query("users").collect();
    let claimed = 0;
    for (const user of users) {
      if (!user.email) continue;
      const emailKey = normalizeEmail(user.email);
      if (!emailKey) continue;
      const existing = await ctx.db
        .query("trialGrants")
        .withIndex("by_emailKey", (q) => q.eq("emailKey", emailKey))
        .unique();
      if (existing) {
        // Only reattach cleared grants — never steal from a live user.
        if (existing.userId === undefined) {
          await ctx.db.patch("trialGrants", existing._id, { userId: user._id as Id<"users"> });
        }
        continue;
      }
      await claimTrialGrant(ctx, user._id as Id<"users">, user.email);
      claimed += 1;
    }

    return { updated, merged, claimed };
  },
});

/**
 * Schedule `markExpired` (or set `expiredAt` immediately) for every trial grant
 * that lacks an expiration job. Required after deploying the scheduled-expiry flag.
 *
 *   bunx convex run trialBackfill:scheduleExpiryJobs
 */
export const scheduleExpiryJobs = internalMutation({
  args: {},
  returns: v.object({
    expired: v.number(),
    scheduled: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx) => {
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- one-shot backfill
    const grants = await ctx.db.query("trialGrants").collect();
    const now = Date.now();
    let expired = 0;
    let scheduled = 0;
    let skipped = 0;

    for (const grant of grants) {
      if (grant.expiredAt !== undefined) {
        skipped += 1;
        continue;
      }
      if (grant.endsAt <= now) {
        await ctx.db.patch("trialGrants", grant._id, { expiredAt: now });
        expired += 1;
        continue;
      }
      if (grant.expirationJobId !== undefined) {
        skipped += 1;
        continue;
      }
      const expirationJobId = await scheduleTrialExpiry(ctx, grant._id, grant.endsAt);
      await ctx.db.patch("trialGrants", grant._id, { expirationJobId });
      scheduled += 1;
    }

    return { expired, scheduled, skipped };
  },
});
