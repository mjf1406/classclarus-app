import { v } from "convex/values";

import { authz } from "./authz.js";
import { internalAction, internalMutation } from "./_generated/server.js";
import { classScope, permissionsForRole } from "./lib/authzModel.js";
import { permissionSnapshotForScope } from "./lib/permissionSnapshot.js";

/**
 * Re-materialize effective permissions after `defineRoles` / `definePermissions` changes.
 * Run once after deploying role-catalog updates (e.g. moving `files:create` to teacher):
 * `bunx convex run authzBackfill:syncCatalogRoles`
 */
export const syncCatalogRoles = internalAction({
  args: {},
  returns: v.object({
    rolesProcessed: v.number(),
    usersProcessed: v.number(),
  }),
  handler: async (ctx) => {
    return await authz.syncRoles(ctx);
  },
});

/**
 * One-time backfill: assign the owner role for every existing class.
 * Safe to re-run — assignRole upserts / extends existing assignments.
 */
export const assignOwnerRoles = internalMutation({
  args: {},
  returns: v.object({
    assigned: v.number(),
    skipped: v.number(),
  }),
  handler: async (ctx) => {
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- one-time backfill over bounded class table
    const classes = await ctx.db.query("classes").collect();
    let assigned = 0;
    let skipped = 0;

    for (const classDoc of classes) {
      const scope = classScope(classDoc._id);
      const alreadyOwner = await authz.hasRole(ctx, classDoc.ownerId, "owner", scope);
      if (alreadyOwner) {
        skipped += 1;
        continue;
      }
      await authz.assignRole(ctx, classDoc.ownerId, "owner", scope);
      assigned += 1;
    }

    return { assigned, skipped };
  },
});

/**
 * Smoke-test role inheritance + suspend deny override without touching real users.
 */
export const smokeVerify = internalMutation({
  args: { classId: v.id("classes") },
  returns: v.object({
    ownerCanDelete: v.boolean(),
    ownerPermissionCount: v.number(),
    studentCanRead: v.boolean(),
    studentCanUpdate: v.boolean(),
    studentPermissionCount: v.number(),
    suspendedCanRead: v.boolean(),
    studentPermsMatchModel: v.boolean(),
  }),
  handler: async (ctx, args) => {
    if (process.env.ALLOW_SMOKE_TESTS !== "true") {
      throw new Error(
        "smokeVerify is disabled. Set ALLOW_SMOKE_TESTS=true on the deployment to run.",
      );
    }
    const classDoc = await ctx.db.get("classes", args.classId);
    if (!classDoc) {
      throw new Error("Class not found");
    }
    const scope = classScope(args.classId);
    const ownerSnapshot = await permissionSnapshotForScope(ctx, classDoc.ownerId, scope);
    const ownerCanDelete = await authz.can(ctx, classDoc.ownerId, "class:delete", scope);

    const testUser = `smoke:student:${args.classId}`;
    await authz.assignRole(ctx, testUser, "student", scope);
    const studentCanRead = await authz.can(ctx, testUser, "class:read", scope);
    const studentCanUpdate = await authz.can(ctx, testUser, "class:update", scope);
    const studentSnapshot = await permissionSnapshotForScope(ctx, testUser, scope);
    const modelPerms = new Set(permissionsForRole("student"));
    const studentPermsMatchModel =
      studentSnapshot.permissions.length === modelPerms.size &&
      studentSnapshot.permissions.every((p) => modelPerms.has(p));

    await authz.denyPermission(ctx, testUser, "*", scope, "smoke suspend");
    const suspendedCanRead = await authz.can(ctx, testUser, "class:read", scope);

    await authz.removeOverride(ctx, testUser, "*", scope);
    await authz.revokeAllRoles(ctx, testUser, scope);

    return {
      ownerCanDelete,
      ownerPermissionCount: ownerSnapshot.permissions.length,
      studentCanRead,
      studentCanUpdate,
      studentPermissionCount: studentSnapshot.permissions.length,
      suspendedCanRead,
      studentPermsMatchModel,
    };
  },
});
