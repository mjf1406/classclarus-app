import { ConvexError, v } from "convex/values";
import { invalidateSessions } from "@convex-dev/auth/server";

import { api, internal } from "./_generated/api.js";
import { action } from "./_generated/server.js";
import { authedMutation, authedQuery } from "./lib/customFunctions.js";
import {
  accountDeleteConfirmationPhrase,
  deleteAccountData,
  getAccountDeletionBlockers,
} from "./lib/accountDeletion.js";
import { rateLimiter } from "./lib/rateLimiter.js";

const deletionBlockerValidator = v.union(
  v.literal("owns_classes"),
  v.literal("active_subscription"),
);

export const getDeletionBlockers = authedQuery({
  args: {},
  returns: v.array(deletionBlockerValidator),
  handler: async (ctx) => {
    return await getAccountDeletionBlockers(ctx, ctx.userId);
  },
});

export const deleteAccount = authedMutation({
  args: {
    confirmation: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "accountDelete", { key: ctx.userId, throws: true });

    const user = await ctx.db.get("users", ctx.userId);
    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    const expected = accountDeleteConfirmationPhrase(user.email);
    if (args.confirmation !== expected) {
      throw new ConvexError({
        code: "CONFIRMATION_MISMATCH",
        message: `Type "${expected}" to confirm deletion`,
      });
    }

    await deleteAccountData(ctx, ctx.userId);
    return null;
  },
});

/**
 * Revoke all sessions except the caller's current one.
 * Keeps the current device signed in; other devices must sign in again.
 */
export const signOutOtherSessions = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await ctx.runQuery(api.users.currentUser, {});
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Not authenticated",
      });
    }
    await ctx.runMutation(internal.lib.rateLimitActions.consume, {
      name: "signOutOtherSessions",
      key: user._id,
    });

    const session = await ctx.runQuery(api.users.currentSession, {});
    await invalidateSessions(ctx, {
      userId: user._id,
      except: session ? [session._id] : [],
    });
    return null;
  },
});
