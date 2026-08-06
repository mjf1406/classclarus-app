import {
  getAuthUserId,
  invalidateSessions,
  modifyAccountCredentials,
} from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import { action, internalQuery, query } from "./_generated/server.js";
import { authz } from "./authz.js";
import { requireAdmin, requireAppAdmin } from "./lib/admin.js";
import { authedQuery } from "./lib/customFunctions.js";
import { isSelfHosted } from "./lib/selfHosted.js";

const PASSWORD_PROVIDER = "password";
const MIN_PASSWORD_LENGTH = 8;

const adminUserValidator = v.object({
  _id: v.id("users"),
  email: v.string(),
  name: v.optional(v.string()),
  hasPassword: v.boolean(),
});

/**
 * Soft check for nav / route gating. Never throws — non-admins and cloud
 * deployments get `{ isAdmin: false }`.
 */
export const isAppAdmin = query({
  args: {},
  returns: v.object({ isAdmin: v.boolean() }),
  handler: async (ctx) => {
    if (!isSelfHosted()) {
      return { isAdmin: false };
    }
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { isAdmin: false };
    }
    const allowed = await authz.can(ctx, userId, "admin:manageUsers");
    return { isAdmin: allowed };
  },
});

export const listUsers = authedQuery({
  args: {},
  returns: v.array(adminUserValidator),
  handler: async (ctx) => {
    if (!isSelfHosted()) {
      throw new ConvexError({
        code: "SELF_HOSTED_ONLY",
        message: "Admin user management is only available on self-hosted instances",
      });
    }
    await requireAppAdmin(ctx, "admin:manageUsers");

    // Classroom-scale instances — a full collect is intentional.
    // eslint-disable-next-line @convex-dev/no-collect-in-query
    const users = await ctx.db.query("users").collect();

    const rows = await Promise.all(
      users.map(async (user) => {
        const email = user.email?.trim();
        if (!email) {
          return null;
        }
        const passwordAccount = await ctx.db
          .query("authAccounts")
          .withIndex("userIdAndProvider", (q) =>
            q.eq("userId", user._id).eq("provider", PASSWORD_PROVIDER),
          )
          .unique();
        return {
          _id: user._id,
          email,
          name: user.name,
          hasPassword: passwordAccount !== null,
        };
      }),
    );

    return rows
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => a.email.localeCompare(b.email));
  },
});

export const getUserPasswordAccount = internalQuery({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(
    v.object({
      email: v.string(),
      hasPassword: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    const email = user?.email?.trim();
    if (!email) {
      return null;
    }
    const passwordAccount = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", args.userId).eq("provider", PASSWORD_PROVIDER),
      )
      .unique();
    return {
      email,
      hasPassword: passwordAccount !== null,
    };
  },
});

/**
 * Set a new password for a user (self-host / Electron admin).
 * Invalidates all of that user's sessions so they must sign in again.
 */
export const resetPassword = action({
  args: {
    userId: v.id("users"),
    newPassword: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!isSelfHosted()) {
      throw new ConvexError({
        code: "SELF_HOSTED_ONLY",
        message: "Admin user management is only available on self-hosted instances",
      });
    }

    const admin = await requireAdmin(ctx, "admin:manageUsers");

    await ctx.runMutation(internal.lib.rateLimitActions.consume, {
      name: "adminResetPassword",
      key: admin.userId,
    });

    const newPassword = args.newPassword;
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new ConvexError({
        code: "INVALID_PASSWORD",
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    const account = await ctx.runQuery(internal.adminUsers.getUserPasswordAccount, {
      userId: args.userId as Id<"users">,
    });
    if (!account) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }
    if (!account.hasPassword) {
      throw new ConvexError({
        code: "NO_PASSWORD_ACCOUNT",
        message: "User does not have a password sign-in method",
      });
    }

    await modifyAccountCredentials(ctx, {
      provider: PASSWORD_PROVIDER,
      account: { id: account.email, secret: newPassword },
    });
    await invalidateSessions(ctx, { userId: args.userId });
    return null;
  },
});
