import { ConvexError, v } from "convex/values";

import { api } from "../_generated/api.js";
import type { Id } from "../_generated/dataModel.js";
import {
  internalMutation,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server.js";
import { authz } from "../authz.js";
import type { AppPermission } from "./authzModel.js";
import { requireAuthUserId } from "./auth.js";

type AdminPermission = Extract<AppPermission, `admin:${string}`>;

/**
 * Require the signed-in user to hold a global unscoped admin permission
 * (Query / Mutation context).
 */
export async function requireAppAdmin(
  ctx: QueryCtx | MutationCtx,
  permission: AdminPermission = "admin:manageUsers",
): Promise<Id<"users">> {
  const userId = await requireAuthUserId(ctx);
  const allowed = await authz.can(ctx, userId, permission);
  if (!allowed) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return userId;
}

/**
 * Require the signed-in user to hold a global unscoped admin permission
 * (Action context). Defaults to Polar `admin:syncProducts` for backward compat.
 */
export async function requireAdmin(
  ctx: ActionCtx,
  permission: AdminPermission = "admin:syncProducts",
): Promise<{ userId: string; email: string }> {
  const user = await ctx.runQuery(api.users.currentUser, {});
  if (!user?.email) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Not authenticated",
    });
  }
  const allowed = await authz.can(ctx, user._id, permission);
  if (!allowed) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return { userId: user._id, email: user.email };
}

/**
 * One-time seeder: grant the global `app_admin` role to a user.
 * PowerShell: `bunx convex run lib/admin:grantAppAdmin '{\"userId\":\"...\"}'`
 * bash/zsh: `bunx convex run lib/admin:grantAppAdmin '{"userId":"..."}'`
 */
export const grantAppAdmin = internalMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId as Id<"users">);
    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }
    await authz.assignRole(ctx, args.userId, "app_admin");
    return null;
  },
});
