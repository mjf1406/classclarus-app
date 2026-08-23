import { v } from "convex/values";

import { internalMutation } from "./_generated/server.js";
import type { Id } from "./_generated/dataModel.js";
import { notifications } from "./lib/notifications/client.js";
import { upsertHistoryFromComponentItem } from "./lib/notifications/history.js";

const USER_PAGE_SIZE = 8;
const NOTIFICATION_PAGE_SIZE = 50;

/**
 * Seed `notificationHistory` from existing component inbox rows, including dismissed.
 * Safe to re-run — upserts skip unchanged documents.
 *
 *   bunx convex run notificationHistoryBackfill:seedFromInbox
 */
export const seedFromInbox = internalMutation({
  args: {
    userCursor: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    notificationCursor: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    inserted: v.number(),
    patched: v.number(),
    skipped: v.number(),
    continueUserCursor: v.union(v.string(), v.null()),
    continueUserId: v.union(v.id("users"), v.null()),
    continueNotificationCursor: v.union(v.number(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    let processed = 0;
    let inserted = 0;
    let patched = 0;
    let skipped = 0;

    const record = (result: "inserted" | "patched" | "skipped") => {
      processed += 1;
      if (result === "inserted") inserted += 1;
      else if (result === "patched") patched += 1;
      else skipped += 1;
    };

    if (args.userId) {
      const page = await notifications.listPage(ctx, {
        targetId: args.userId,
        includeDismissed: true,
        limit: NOTIFICATION_PAGE_SIZE,
        ...(args.notificationCursor !== undefined ? { cursor: args.notificationCursor } : {}),
      });
      for (const item of page.page) {
        record(await upsertHistoryFromComponentItem(ctx, args.userId, item));
      }
      if (!page.isDone) {
        return {
          processed,
          inserted,
          patched,
          skipped,
          continueUserCursor: args.userCursor ?? null,
          continueUserId: args.userId,
          continueNotificationCursor: page.continueCursor ?? null,
          isDone: false,
        };
      }
    }

    const usersPage = await ctx.db.query("users").paginate({
      numItems: USER_PAGE_SIZE,
      cursor: args.userCursor ?? null,
    });

    const startIndex = args.userId
      ? usersPage.page.findIndex((user) => user._id === args.userId) + 1
      : 0;

    for (let index = Math.max(0, startIndex); index < usersPage.page.length; index += 1) {
      const user = usersPage.page[index];
      if (!user) continue;
      const page = await notifications.listPage(ctx, {
        targetId: user._id,
        includeDismissed: true,
        limit: NOTIFICATION_PAGE_SIZE,
      });
      for (const item of page.page) {
        record(await upsertHistoryFromComponentItem(ctx, user._id as Id<"users">, item));
      }
      if (!page.isDone) {
        return {
          processed,
          inserted,
          patched,
          skipped,
          continueUserCursor: args.userCursor ?? null,
          continueUserId: user._id as Id<"users">,
          continueNotificationCursor: page.continueCursor ?? null,
          isDone: false,
        };
      }
    }

    return {
      processed,
      inserted,
      patched,
      skipped,
      continueUserCursor: usersPage.isDone ? null : usersPage.continueCursor,
      continueUserId: null,
      continueNotificationCursor: null,
      isDone: usersPage.isDone,
    };
  },
});
