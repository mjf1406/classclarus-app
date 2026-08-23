import { v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server.js";

export const listForUser = internalQuery({
  args: {
    userId: v.id("users"),
  },
  returns: v.array(
    v.object({
      endpoint: v.string(),
      p256dh: v.string(),
      auth: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- per-user push endpoints are bounded
    const rows = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    return rows.map((row) => ({
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      auth: row.auth,
    }));
  },
});

export const removeByEndpoint = internalMutation({
  args: {
    endpoint: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint", (q) => q.eq("endpoint", args.endpoint))
      .unique();
    if (existing) {
      await ctx.db.delete("pushSubscriptions", existing._id);
    }
    return null;
  },
});
