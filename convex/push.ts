import { v } from "convex/values";

import { authedMutation, authedQuery } from "./lib/auth/customFunctions.js";
import { rateLimiter } from "./lib/rateLimit/rateLimiter.js";

const vapidPublicKeyValidator = v.union(v.string(), v.null());

export function readVapidPublicKey(): string | null {
  const value = process.env.VAPID_PUBLIC_KEY?.trim();
  return value && value.length > 0 ? value : null;
}

export const getVapidPublicKey = authedQuery({
  args: {},
  returns: vapidPublicKeyValidator,
  handler: async () => readVapidPublicKey(),
});

export const subscribe = authedMutation({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    userAgent: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "pushSubscribe", { key: ctx.userId, throws: true });
    const endpoint = args.endpoint.trim();
    const p256dh = args.p256dh.trim();
    const auth = args.auth.trim();
    if (!endpoint || !p256dh || !auth) {
      throw new Error("Invalid push subscription");
    }
    const now = Date.now();
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .unique();
    if (existing) {
      await ctx.db.patch("pushSubscriptions", existing._id, {
        userId: ctx.userId,
        p256dh,
        auth,
        userAgent: args.userAgent,
        updatedAt: now,
      });
      return null;
    }
    await ctx.db.insert("pushSubscriptions", {
      userId: ctx.userId,
      endpoint,
      p256dh,
      auth,
      userAgent: args.userAgent,
      createdAt: now,
      updatedAt: now,
    });
    return null;
  },
});

export const unsubscribe = authedMutation({
  args: {
    endpoint: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "pushUnsubscribe", { key: ctx.userId, throws: true });
    const endpoint = args.endpoint.trim();
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
      .unique();
    if (!existing) {
      return null;
    }
    if (existing.userId !== ctx.userId) {
      throw new Error("Not authenticated");
    }
    await ctx.db.delete("pushSubscriptions", existing._id);
    return null;
  },
});

export const listMine = authedQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("pushSubscriptions"),
      endpoint: v.string(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- per-user push endpoints are bounded
    const rows = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
      .collect();
    return rows.map((row) => ({
      _id: row._id,
      endpoint: row.endpoint,
      createdAt: row.createdAt,
    }));
  },
});
