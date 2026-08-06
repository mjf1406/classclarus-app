import { ConvexError, v } from "convex/values";
import { customMutation, customQuery } from "convex-helpers/server/customFunctions";

import type { Doc, Id } from "../_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "../_generated/server.js";
import { mutation, query } from "../_generated/server.js";
import { authz } from "../authz.js";
import type { ClassPermission } from "./authzModel.js";
import { classScope } from "./authzModel.js";
import { requireAuthUserId } from "./auth.js";
import { assertEntitled } from "./entitlement.js";

type AuthedCtx = (QueryCtx | MutationCtx) & { userId: Id<"users"> };

/**
 * Load a class and inject scope + can/require helpers.
 * Requires `class:read` so non-members get the same CLASS_UNAVAILABLE denial
 * for both real and fabricated class IDs (no existence oracle).
 */
async function loadClassContext(ctx: AuthedCtx, classId: Id<"classes">) {
  const classDoc = await ctx.db.get("classes", classId);
  if (!classDoc) {
    throw new ConvexError({
      code: "CLASS_UNAVAILABLE",
      message: "Class not found or access denied",
    });
  }
  const scope = classScope(classId);

  const requirePermission = async (permission: ClassPermission) => {
    try {
      await authz.require(ctx, ctx.userId, permission, scope);
    } catch {
      // Skip logging for the uniform class:read gate — fabricated IDs would flood logs.
      if (permission !== "class:read") {
        console.error("Class permission denied", {
          classId,
          userId: ctx.userId,
          permission,
        });
      }
      throw new ConvexError({
        code: "CLASS_UNAVAILABLE",
        message: "Class not found or access denied",
      });
    }
  };

  // Uniform deny for non-members — closes the existence oracle on class-scoped queries.
  await requirePermission("class:read");

  return {
    classDoc: classDoc as Doc<"classes">,
    scope,
    can: (permission: ClassPermission) => authz.can(ctx, ctx.userId, permission, scope),
    require: requirePermission,
  };
}

/**
 * Mutation wrapper that requires authentication.
 * Soft-auth queries (empty/null when logged out) should keep using plain `query`.
 *
 * Note: wrappers are built from base `mutation`/`query` (not nested custom builders).
 * Nesting `customMutation(authedMutation, …)` loses CustomCtx typing in convex-helpers.
 */
export const authedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return { ctx: { userId }, args: {} };
  },
});

/**
 * Mutation wrapper that requires authentication + an active trial or subscription.
 * Reserved for pay-to-create paths (e.g. `classes.create`). Class membership
 * and day-to-day class ops use `authedMutation` / `classMutation` instead.
 */
export const entitledMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    await assertEntitled(ctx, userId);
    return { ctx: { userId }, args: {} };
  },
});

/**
 * Query wrapper that requires authentication.
 *
 * This should be used for queries that should never run while logged out.
 * Client-side, use `useAuthedQuery` to avoid calling the query with "skip".
 */
export const authedQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return { ctx: { userId }, args: {} };
  },
});

/**
 * Query wrapper that requires authentication + an active trial or subscription.
 * Prefer `authedQuery` for membership reads; keep this for rare paid-only reads.
 */
export const entitledQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    await assertEntitled(ctx, userId);
    return { ctx: { userId }, args: {} };
  },
});

/**
 * Class-scoped mutation: loads the class, injects scope + can/require helpers.
 * Callers still enforce the specific permission they need via `ctx.require(...)`.
 * Does not require entitlement (exit paths: delete, transfer ownership).
 */
export const classMutation = customMutation(mutation, {
  args: { classId: v.id("classes") },
  input: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const classCtx = await loadClassContext({ ...ctx, userId }, args.classId);
    return {
      ctx: {
        userId,
        ...classCtx,
      },
      args: {},
    };
  },
});

/**
 * Class-scoped mutation that also requires an active trial or subscription.
 * Prefer `classMutation` for membership writes; keep for rare paid-only class writes.
 */
export const entitledClassMutation = customMutation(mutation, {
  args: { classId: v.id("classes") },
  input: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    await assertEntitled(ctx, userId);
    const classCtx = await loadClassContext({ ...ctx, userId }, args.classId);
    return {
      ctx: {
        userId,
        ...classCtx,
      },
      args: {},
    };
  },
});

/**
 * Class-scoped query: loads the class, injects scope + can/require helpers.
 * Does not require entitlement (membership reads and class interaction).
 */
export const classQuery = customQuery(query, {
  args: { classId: v.id("classes") },
  input: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const classCtx = await loadClassContext({ ...ctx, userId }, args.classId);
    return {
      ctx: {
        userId,
        ...classCtx,
      },
      args: {},
    };
  },
});

/**
 * Class-scoped query that also requires an active trial or subscription.
 * Prefer `classQuery` for membership reads; keep for rare paid-only class reads.
 */
export const entitledClassQuery = customQuery(query, {
  args: { classId: v.id("classes") },
  input: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    await assertEntitled(ctx, userId);
    const classCtx = await loadClassContext({ ...ctx, userId }, args.classId);
    return {
      ctx: {
        userId,
        ...classCtx,
      },
      args: {},
    };
  },
});
