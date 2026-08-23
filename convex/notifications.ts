import { getAuthUserId } from "@convex-dev/auth/server";
import { makeNotificationAPI } from "convex-notification/server";
import { v } from "convex/values";

import { authedMutation, authedQuery } from "./lib/customFunctions.js";
import {
  HISTORY_PAGE_SIZE,
  HISTORY_PAGE_SIZE_MAX,
  listHistoryForUser,
  markAllHistoryDismissed,
  markAllHistorySeen,
  markHistoryDismissed,
  markHistorySeen,
  type NotificationHistoryStatus,
} from "./lib/notifications/history.js";
import { notifications } from "./lib/notifications/client.js";

const userNotifications = makeNotificationAPI(notifications, {
  resolveTargetId: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }
    return userId;
  },
});

export const { list, listPage, counts, unseenCount } = userNotifications;

const historyItemValidator = v.object({
  _id: v.id("notificationHistory"),
  notificationId: v.string(),
  sequence: v.number(),
  kind: v.string(),
  statusKey: v.union(v.literal("unread"), v.literal("read"), v.literal("dismissed")),
  title: v.string(),
  description: v.optional(v.string()),
  classId: v.optional(v.string()),
  className: v.optional(v.string()),
  eventId: v.optional(v.string()),
  href: v.string(),
  isSeen: v.boolean(),
  isDismissed: v.boolean(),
  seenAt: v.optional(v.number()),
  dismissedAt: v.optional(v.number()),
  createdAt: v.number(),
});

const historyStatusValidator = v.union(
  v.literal("all"),
  v.literal("unread"),
  v.literal("read"),
  v.literal("dismissed"),
);

export const listHistory = authedQuery({
  args: {
    searchQuery: v.optional(v.string()),
    status: v.optional(historyStatusValidator),
    kind: v.optional(v.string()),
    classId: v.optional(v.string()),
    createdAfterMs: v.optional(v.number()),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    page: v.array(historyItemValidator),
    continueCursor: v.optional(v.string()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit ?? HISTORY_PAGE_SIZE;
    if (limit < 1 || limit > HISTORY_PAGE_SIZE_MAX) {
      throw new Error("Invalid page size");
    }
    return await listHistoryForUser(ctx, ctx.userId, {
      searchQuery: args.searchQuery ?? "",
      status: (args.status ?? "all") as NotificationHistoryStatus | "all",
      ...(args.kind ? { kind: args.kind } : {}),
      ...(args.classId ? { classId: args.classId } : {}),
      ...(args.createdAfterMs !== undefined ? { createdAfterMs: args.createdAfterMs } : {}),
      ...(args.cursor ? { cursor: args.cursor } : {}),
      limit,
    });
  },
});

export const markSeen = authedMutation({
  args: { notificationId: v.string() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const result = await notifications.markSeen(ctx, {
      targetId: ctx.userId,
      notificationId: args.notificationId as never,
    });
    await markHistorySeen(ctx, ctx.userId, args.notificationId, Date.now());
    return result;
  },
});

export const markAllSeen = authedMutation({
  args: {},
  returns: v.object({ touched: v.number() }),
  handler: async (ctx) => {
    const result = await notifications.markAllSeen(ctx, { targetId: ctx.userId });
    await markAllHistorySeen(ctx, ctx.userId, Date.now());
    return result;
  },
});

export const dismiss = authedMutation({
  args: { notificationId: v.string() },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const result = await notifications.dismiss(ctx, {
      targetId: ctx.userId,
      notificationId: args.notificationId as never,
    });
    await markHistoryDismissed(ctx, ctx.userId, args.notificationId, Date.now());
    return result;
  },
});

export const dismissAll = authedMutation({
  args: {},
  returns: v.object({ touched: v.number() }),
  handler: async (ctx) => {
    const result = await notifications.dismissAll(ctx, { targetId: ctx.userId });
    await markAllHistoryDismissed(ctx, ctx.userId, Date.now());
    return result;
  },
});
