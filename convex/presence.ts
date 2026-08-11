import { Presence } from "@convex-dev/presence";
import { ConvexError, v } from "convex/values";

import { components } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import { mutation, query } from "./_generated/server.js";
import { authz } from "./authz.js";
import { authedMutation, classQuery } from "./lib/customFunctions.js";
import { classScope } from "./lib/authzModel.js";
import { isClassPresenceEnabled } from "./lib/presenceEnabled.js";
import { resolveUserImageUrl } from "./lib/userImage.js";

const presence = new Presence(components.presence);

/** Matches `@convex-dev/presence` default list limit. */
const PRESENCE_LIST_LIMIT = 104;

const heartbeatResultValidator = v.object({
  roomToken: v.string(),
  sessionToken: v.string(),
});

const presenceEntryValidator = v.object({
  userId: v.string(),
  online: v.boolean(),
  lastDisconnected: v.number(),
  data: v.optional(v.any()),
});

const presenceDisplaySummaryValidator = v.object({
  userId: v.id("users"),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
});

/**
 * Keepalive for class presence rooms (`roomId` = class id).
 * Requires auth + `class:read`.
 * Always heartbeats as the authenticated user — ignores spoofed `userId`.
 */
export const heartbeat = authedMutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    interval: v.number(),
  },
  returns: heartbeatResultValidator,
  handler: async (ctx, { roomId, userId, sessionId, interval }) => {
    if (!isClassPresenceEnabled()) {
      throw new ConvexError({
        code: "PRESENCE_DISABLED",
        message: "Class presence is disabled",
      });
    }

    if (userId !== ctx.userId) {
      throw new ConvexError({
        code: "CLASS_UNAVAILABLE",
        message: "Class not found or access denied",
      });
    }

    const classId = ctx.db.normalizeId("classes", roomId);
    if (!classId) {
      throw new ConvexError({
        code: "CLASS_UNAVAILABLE",
        message: "Class not found or access denied",
      });
    }

    const classDoc = await ctx.db.get("classes", classId);
    if (!classDoc) {
      throw new ConvexError({
        code: "CLASS_UNAVAILABLE",
        message: "Class not found or access denied",
      });
    }

    try {
      await authz.require(ctx, ctx.userId, "class:read", classScope(classId));
    } catch {
      throw new ConvexError({
        code: "CLASS_UNAVAILABLE",
        message: "Class not found or access denied",
      });
    }

    return await presence.heartbeat(ctx, classId, ctx.userId, sessionId, interval);
  },
});

/**
 * Room presence list. Auth is the opaque `roomToken` from heartbeat —
 * avoid per-subscriber reads so subscriptions share a cache.
 */
export const list = query({
  args: { roomToken: v.string() },
  returns: v.array(presenceEntryValidator),
  handler: async (ctx, { roomToken }) => {
    if (!isClassPresenceEnabled()) {
      return [];
    }
    return await presence.list(ctx, roomToken);
  },
});

/**
 * Display summaries for online users in a class room.
 * Requires auth + `class:read`; skips users who cannot read the class.
 */
export const displaySummaries = classQuery({
  args: {
    userIds: v.array(v.string()),
  },
  returns: v.array(presenceDisplaySummaryValidator),
  handler: async (ctx, { userIds }) => {
    if (!isClassPresenceEnabled()) {
      return [];
    }

    const uniqueUserIds = [...new Set(userIds)].slice(0, PRESENCE_LIST_LIMIT);
    const summaries: Array<{
      userId: Id<"users">;
      name?: string;
      image?: string;
    }> = [];

    for (const userId of uniqueUserIds) {
      const normalizedUserId = ctx.db.normalizeId("users", userId);
      if (!normalizedUserId) {
        continue;
      }

      const canReadClass = await authz.can(ctx, normalizedUserId, "class:read", ctx.scope);
      if (!canReadClass) {
        continue;
      }

      const user = await ctx.db.get("users", normalizedUserId);
      if (!user) {
        continue;
      }

      summaries.push({
        userId: user._id,
        name: user.name,
        image: await resolveUserImageUrl(ctx, user),
      });
    }

    return summaries;
  },
});

/**
 * Graceful disconnect. Called via sendBeacon on tab close — no auth check.
 */
export const disconnect = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, { sessionToken }) => {
    if (!isClassPresenceEnabled()) {
      return null;
    }
    await presence.disconnect(ctx, sessionToken);
    return null;
  },
});
