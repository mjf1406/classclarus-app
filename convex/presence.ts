import { Presence } from "@convex-dev/presence";
import { ConvexError, v } from "convex/values";

import { components } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import { mutation, query } from "./_generated/server.js";
import { authz } from "./authz.js";
import { entitledMutation } from "./lib/customFunctions.js";
import { classScope } from "./lib/authzModel.js";
import { resolveUserImageUrl } from "./lib/userImage.js";

const presence = new Presence(components.presence);

const heartbeatResultValidator = v.object({
  roomToken: v.string(),
  sessionToken: v.string(),
});

const presenceEntryValidator = v.object({
  userId: v.string(),
  online: v.boolean(),
  lastDisconnected: v.number(),
  data: v.optional(v.any()),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
});

/**
 * Keepalive for class presence rooms (`roomId` = class id).
 * Requires entitlement (no-op on self-host/Electron) + `class:read`.
 * Always heartbeats as the authenticated user — ignores spoofed `userId`.
 */
export const heartbeat = entitledMutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    interval: v.number(),
  },
  returns: heartbeatResultValidator,
  handler: async (ctx, { roomId, userId, sessionId, interval }) => {
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
    const presenceList = await presence.list(ctx, roomToken);
    return await Promise.all(
      presenceList.map(async (entry) => {
        const user = await ctx.db.get("users", entry.userId as Id<"users">);
        if (!user) {
          return entry;
        }
        return {
          ...entry,
          name: user.name,
          image: await resolveUserImageUrl(ctx, user),
        };
      }),
    );
  },
});

/**
 * Graceful disconnect. Called via sendBeacon on tab close — no auth check.
 */
export const disconnect = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, { sessionToken }) => {
    await presence.disconnect(ctx, sessionToken);
    return null;
  },
});
