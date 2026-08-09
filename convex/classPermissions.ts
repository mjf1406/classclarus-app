import { v } from "convex/values";

import { APP_CONFIG } from "./appConfig.js";
import { authz } from "./authz.js";
import { components } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import {
  GRANTABLE_CLASS_PERMISSIONS,
  canManageClassRoles,
  classScope,
  effectivePermissionEnabled,
  isClassRole,
  isGrantableClassPermission,
  isPermissionOverrideTargetRole,
  isStrictlyBelow,
  permissionsForRole,
  pickHighestClassRole,
  type ClassPermission,
  type PermissionOverrideEffect,
  type PermissionOverrideTargetRole,
} from "./lib/authzModel.js";
import { recordClassActivity } from "./lib/classActivity.js";
import {
  hasFineGrainedClassPermissionOverrides,
  listClassPermissionOverrides,
} from "./lib/classPermissionOverrides.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import { resolveUserImageUrl } from "./lib/userImage.js";

const staffRoleValidator = v.union(v.literal("teacher"), v.literal("assistant_teacher"));

const staffMemberValidator = v.object({
  userId: v.id("users"),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  email: v.optional(v.string()),
  role: staffRoleValidator,
});

const permissionEntryValidator = v.object({
  permission: v.string(),
  roleDefault: v.boolean(),
  override: v.union(v.literal("allow"), v.literal("deny"), v.null()),
  effective: v.boolean(),
});

async function requirePermissionOverrideTarget(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  actorUserId: Id<"users">,
  targetUserId: Id<"users">,
): Promise<PermissionOverrideTargetRole> {
  if (targetUserId === actorUserId) {
    throw new Error("You cannot edit your own permissions");
  }
  const scope = classScope(classId);
  const targetRoles = await authz.getUserRoles(ctx, targetUserId, scope);
  const role = pickHighestClassRole(
    targetRoles.map((entry: { role: string }) => entry.role).filter(isClassRole),
  );
  if (!role || !isPermissionOverrideTargetRole(role)) {
    throw new Error("Only teachers and assistant teachers can receive permission overrides");
  }
  return role;
}

/**
 * Staff members (teachers + assistant teachers) for the owner Permissions page.
 */
export const listStaffForPermissions = classQuery({
  args: {},
  returns: v.array(staffMemberValidator),
  handler: async (ctx) => {
    await ctx.require("permissions:manage");

    const byUserId = new Map<string, PermissionOverrideTargetRole>();
    for (const role of ["teacher", "assistant_teacher"] as const) {
      const users = await ctx.runQuery(components.authz.queries.getUsersWithRole, {
        tenantId: APP_CONFIG.authzTenantId,
        role,
        scope: ctx.scope,
      });
      for (const entry of users) {
        const existing = byUserId.get(entry.userId);
        const next = pickHighestClassRole([...(existing ? [existing] : []), role]);
        if (next && isPermissionOverrideTargetRole(next)) {
          byUserId.set(entry.userId, next);
        }
      }
    }

    const members: Array<{
      userId: Id<"users">;
      name?: string;
      image?: string;
      email?: string;
      role: PermissionOverrideTargetRole;
    }> = [];

    for (const [userId, role] of byUserId) {
      if (userId === ctx.userId) continue;
      const user = await ctx.db.get("users", userId as Id<"users">);
      if (!user) continue;
      members.push({
        userId: user._id,
        name: user.name,
        image: await resolveUserImageUrl(ctx, user),
        // Staff list — always include email (same as teachers/assistant people pages).
        email: user.email,
        role,
      });
    }

    members.sort((a, b) => {
      const byRole = a.role.localeCompare(b.role);
      if (byRole !== 0) return byRole;
      const nameA = (a.name ?? a.email ?? a.userId).toLocaleLowerCase();
      const nameB = (b.name ?? b.email ?? b.userId).toLocaleLowerCase();
      return nameA.localeCompare(nameB);
    });

    return members;
  },
});

/**
 * Grantable permission matrix for one staff member (role defaults + overrides).
 */
export const forMember = classQuery({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    userId: v.id("users"),
    role: staffRoleValidator,
    permissions: v.array(permissionEntryValidator),
  }),
  handler: async (ctx, args) => {
    await ctx.require("permissions:manage");
    const role = await requirePermissionOverrideTarget(
      ctx,
      ctx.classDoc._id,
      ctx.userId,
      args.userId,
    );
    const rolePerms = new Set(permissionsForRole(role));
    const overrides = await listClassPermissionOverrides(ctx, ctx.classDoc._id, args.userId);
    const overrideByPermission = new Map<string, PermissionOverrideEffect>();
    for (const row of overrides) {
      if (row.permission === "*") continue;
      if (!isGrantableClassPermission(row.permission)) continue;
      overrideByPermission.set(row.permission, row.effect);
    }

    const permissions = GRANTABLE_CLASS_PERMISSIONS.map((permission) => {
      const roleDefault = rolePerms.has(permission);
      const override = overrideByPermission.get(permission) ?? null;
      return {
        permission,
        roleDefault,
        override,
        effective: effectivePermissionEnabled(roleDefault, override),
      };
    });

    return {
      userId: args.userId,
      role,
      permissions,
    };
  },
});

/**
 * Whether a member has fine-grained class permission overrides (excludes suspend `*`).
 * Used by People role-change confirmation.
 */
export const hasPermissionOverrides = classQuery({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    hasOverrides: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const actorRoles = await authz.getUserRoles(ctx, ctx.userId, ctx.scope);
    const actorRole = pickHighestClassRole(
      actorRoles.map((entry: { role: string }) => entry.role).filter(isClassRole),
    );
    if (!actorRole || !canManageClassRoles(actorRole)) {
      throw new Error("Only owners and teachers can check permission overrides");
    }

    const targetRoles = await authz.getUserRoles(ctx, args.userId, ctx.scope);
    const targetRole = pickHighestClassRole(
      targetRoles.map((entry: { role: string }) => entry.role).filter(isClassRole),
    );
    if (!targetRole) {
      throw new Error("Person is not in this class");
    }
    if (!isStrictlyBelow(actorRole, targetRole)) {
      throw new Error("You can only inspect permission overrides for people below you");
    }

    const hasOverrides = await hasFineGrainedClassPermissionOverrides(
      ctx,
      ctx.classDoc._id,
      args.userId,
    );
    return { hasOverrides };
  },
});

/**
 * Set a single grantable permission for a staff member via authz overrides.
 */
export const setMemberPermission = classMutation({
  args: {
    userId: v.id("users"),
    permission: v.string(),
    enabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "memberSetPermission", { key: ctx.userId, throws: true });
    await ctx.require("permissions:manage");

    if (!isGrantableClassPermission(args.permission)) {
      throw new Error("This permission cannot be overridden");
    }
    const permission: ClassPermission = args.permission;
    const role = await requirePermissionOverrideTarget(
      ctx,
      ctx.classDoc._id,
      ctx.userId,
      args.userId,
    );
    const roleDefault = permissionsForRole(role).includes(permission);

    if (args.enabled) {
      if (roleDefault) {
        await authz.removeOverride(ctx, args.userId, permission, ctx.scope);
      } else {
        await authz.grantPermission(
          ctx,
          args.userId,
          permission,
          ctx.scope,
          "Class permission override",
        );
      }
    } else if (roleDefault) {
      await authz.denyPermission(
        ctx,
        args.userId,
        permission,
        ctx.scope,
        "Class permission override",
      );
    } else {
      await authz.removeOverride(ctx, args.userId, permission, ctx.scope);
    }

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "member",
      resourceId: args.userId,
      summary: args.enabled
        ? `Enabled permission ${permission} for member`
        : `Disabled permission ${permission} for member`,
      summaryKey: args.enabled
        ? "activitySummary_enabledMemberPermission"
        : "activitySummary_disabledMemberPermission",
      metadata: {
        permission,
        enabled: String(args.enabled),
        targetUserId: args.userId,
        role,
      },
    });
    return null;
  },
});
