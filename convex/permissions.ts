import { v } from "convex/values";

import { classQuery } from "./lib/customFunctions.js";
import { permissionSnapshotForScope } from "./lib/permissionSnapshot.js";

const classRoleValidator = v.union(
  v.literal("owner"),
  v.literal("teacher"),
  v.literal("assistant_teacher"),
  v.literal("student"),
  v.literal("guardian"),
  v.literal("class_member"),
);

/**
 * Effective permission snapshot for the current user in a class.
 * Used by UI gating (sidebar, action menus, page guards).
 * Requires class:read via classQuery (uniform CLASS_UNAVAILABLE deny).
 */
export const forClass = classQuery({
  args: { classId: v.id("classes") },
  returns: v.object({
    role: v.union(classRoleValidator, v.null()),
    permissions: v.array(v.string()),
  }),
  handler: async (ctx) => {
    return await permissionSnapshotForScope(ctx, ctx.userId, ctx.scope);
  },
});
