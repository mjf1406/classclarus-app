import { v } from "convex/values";

import { APP_CONFIG } from "./appConfig.js";
import { authz } from "./authz.js";
import { components } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import {
  JOIN_CODE_INVITE_PERMISSION_BY_ROLE,
  JOIN_CODE_ROLES,
  canManageClassRoles,
  classScope,
  isClassRole,
  isJoinCodeRole,
  isStrictlyBelow,
  MEMBER_LIST_AUTHZ_ROLES,
  MEMBER_LIST_READ_PERMISSION_BY_ROLE,
  pickHighestClassRole,
  REMOVE_PERMISSION_BY_ROLE,
  SUSPEND_PERMISSION_BY_ROLE,
  type ClassRole,
  type JoinCodeRole,
  type MemberListRole,
} from "./lib/authzModel.js";
import { entitledClassMutation, entitledClassQuery } from "./lib/customFunctions.js";
import {
  clearLinksForUser,
  getClassRoleForUser,
  listLinkedStudentsForGuardian,
} from "./lib/guardianLinks.js";
import { resolveUserImageUrl } from "./lib/userImage.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import { isSelfHosted } from "./lib/selfHosted.js";

const memberListRoleValidator = v.union(
  v.literal("teacher"),
  v.literal("assistant_teacher"),
  v.literal("student"),
  v.literal("guardian"),
);

const classMemberRoleValidator = v.union(
  v.literal("owner"),
  v.literal("teacher"),
  v.literal("assistant_teacher"),
  v.literal("student"),
  v.literal("guardian"),
);

type ListedClassRole = "owner" | "teacher" | "assistant_teacher" | "student" | "guardian";

const linkedStudentValidator = v.object({
  userId: v.id("users"),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
});

const classMemberValidator = v.object({
  userId: v.id("users"),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  email: v.optional(v.string()),
  role: classMemberRoleValidator,
  linkedStudents: v.optional(v.array(linkedStudentValidator)),
});

const memberCountsValidator = v.object({
  teacher: v.union(v.number(), v.null()),
  assistant_teacher: v.union(v.number(), v.null()),
  student: v.union(v.number(), v.null()),
  guardian: v.union(v.number(), v.null()),
});

async function countUsersForListRole(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  listRole: MemberListRole,
): Promise<number> {
  const scope = classScope(classId);
  const userIds = new Set<string>();
  for (const authzRole of MEMBER_LIST_AUTHZ_ROLES[listRole]) {
    const users = await ctx.runQuery(components.authz.queries.getUsersWithRole, {
      tenantId: APP_CONFIG.authzTenantId,
      role: authzRole,
      scope,
    });
    for (const entry of users) {
      userIds.add(entry.userId);
    }
  }
  return userIds.size;
}

/**
 * Suspend / unsuspend a class member via a scoped deny override ("*").
 * Role assignment is preserved; unsuspend removes the override.
 */
export const setSuspended = entitledClassMutation({
  args: {
    userId: v.id("users"),
    suspended: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "memberSuspend", { key: ctx.userId, throws: true });
    if (args.userId === ctx.userId) {
      throw new Error("You cannot suspend yourself");
    }

    const targetRoles = await authz.getUserRoles(ctx, args.userId, ctx.scope);
    const role = pickHighestClassRole(
      targetRoles.map((entry: { role: string }) => entry.role).filter(isClassRole),
    );
    if (!role) {
      throw new Error("Person is not in this class");
    }

    const permission = SUSPEND_PERMISSION_BY_ROLE[role];
    if (!permission) {
      throw new Error("This person cannot be suspended");
    }
    await ctx.require(permission);

    if (args.suspended) {
      await authz.denyPermission(ctx, args.userId, "*", ctx.scope, "Suspended from class");
    } else {
      await authz.removeOverride(ctx, args.userId, "*", ctx.scope);
    }
    return null;
  },
});

/**
 * List members for a people page (teachers includes owners).
 * Class people lists are intentionally small / classroom-sized.
 */
export const listByRole = entitledClassQuery({
  args: {
    role: memberListRoleValidator,
  },
  returns: v.array(classMemberValidator),
  handler: async (ctx, args) => {
    if (!isJoinCodeRole(args.role)) {
      throw new Error("Invalid member list role");
    }
    const listRole: MemberListRole = args.role;
    await ctx.require(MEMBER_LIST_READ_PERMISSION_BY_ROLE[listRole]);

    const authzRoles = MEMBER_LIST_AUTHZ_ROLES[listRole];
    const byUserId = new Map<string, ListedClassRole>();

    for (const authzRole of authzRoles) {
      const users = await ctx.runQuery(components.authz.queries.getUsersWithRole, {
        tenantId: APP_CONFIG.authzTenantId,
        role: authzRole,
        scope: ctx.scope,
      });
      for (const entry of users) {
        const existing = byUserId.get(entry.userId);
        const next = pickHighestClassRole([...(existing ? [existing] : []), authzRole]);
        if (
          next === "owner" ||
          next === "teacher" ||
          next === "assistant_teacher" ||
          next === "student" ||
          next === "guardian"
        ) {
          byUserId.set(entry.userId, next);
        }
      }
    }

    // Cloud: emails only on staff lists. Self-host/Electron: always include email so
    // password accounts without a display name don't show as "Unnamed member".
    const includeEmail =
      isSelfHosted() || listRole === "teacher" || listRole === "assistant_teacher";
    const includeLinks = listRole === "guardian";
    const members: Array<{
      userId: Id<"users">;
      name?: string;
      image?: string;
      email?: string;
      role: ListedClassRole;
      linkedStudents?: Array<{ userId: Id<"users">; name?: string; email?: string }>;
    }> = [];
    for (const [userId, role] of byUserId) {
      const user = await ctx.db.get("users", userId as Id<"users">);
      if (!user) continue;
      members.push({
        userId: user._id,
        name: user.name,
        image: await resolveUserImageUrl(ctx, user),
        email: includeEmail ? user.email : undefined,
        role,
        linkedStudents: includeLinks
          ? await listLinkedStudentsForGuardian(ctx, ctx.classDoc._id, user._id)
          : undefined,
      });
    }

    members.sort((a, b) => {
      const roleRank = (role: ListedClassRole) => (role === "owner" ? 0 : 1);
      const byRole = roleRank(a.role) - roleRank(b.role);
      if (byRole !== 0) return byRole;
      const nameA = (a.name ?? a.email ?? a.userId).toLocaleLowerCase();
      const nameB = (b.name ?? b.email ?? b.userId).toLocaleLowerCase();
      return nameA.localeCompare(nameB);
    });

    return members;
  },
});

/**
 * Sidebar counts per people-list role.
 * Returns null for roles the viewer cannot read.
 */
export const countsByRole = entitledClassQuery({
  args: {},
  returns: memberCountsValidator,
  handler: async (ctx) => {
    const counts: {
      teacher: number | null;
      assistant_teacher: number | null;
      student: number | null;
      guardian: number | null;
    } = {
      teacher: null,
      assistant_teacher: null,
      student: null,
      guardian: null,
    };

    for (const listRole of JOIN_CODE_ROLES) {
      const allowed = await ctx.can(MEMBER_LIST_READ_PERMISSION_BY_ROLE[listRole]);
      if (!allowed) continue;
      counts[listRole] = await countUsersForListRole(ctx, ctx.classDoc._id, listRole);
    }

    return counts;
  },
});

/**
 * Remove a class member by offboarding their scoped authz membership.
 */
export const remove = entitledClassMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "memberRemove", { key: ctx.userId, throws: true });
    if (args.userId === ctx.userId) {
      throw new Error("You cannot remove yourself");
    }

    const targetRoles = await authz.getUserRoles(ctx, args.userId, ctx.scope);
    const role = pickHighestClassRole(
      targetRoles.map((entry: { role: string }) => entry.role).filter(isClassRole),
    );
    if (!role) {
      throw new Error("Person is not in this class");
    }

    const permission = REMOVE_PERMISSION_BY_ROLE[role];
    if (!permission) {
      throw new Error("This person cannot be removed");
    }
    await ctx.require(permission);

    if (role === "guardian" || role === "student") {
      await clearLinksForUser(ctx, ctx.classDoc._id, args.userId);
    }

    await authz.offboardUser(ctx, args.userId, {
      scope: ctx.scope,
      removeOverrides: true,
      removeRelationships: true,
      removeAttributes: false,
    });
    return null;
  },
});

/**
 * Replace a guardian's linked students. Actor needs guardians:invite.
 * Every studentUserId must currently hold the student role in this class.
 */
export const setGuardianStudentLinks = entitledClassMutation({
  args: {
    guardianUserId: v.id("users"),
    studentUserIds: v.array(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "memberSetGuardianLinks", { key: ctx.userId, throws: true });
    await ctx.require("guardians:invite");

    const guardianRole = await getClassRoleForUser(ctx, args.guardianUserId, ctx.scope);
    if (guardianRole !== "guardian") {
      throw new Error("Person is not a guardian in this class");
    }

    const uniqueStudentIds = [...new Set(args.studentUserIds)];
    for (const studentUserId of uniqueStudentIds) {
      const studentRole = await getClassRoleForUser(ctx, studentUserId, ctx.scope);
      if (studentRole !== "student") {
        throw new Error("Linked person must be a student in this class");
      }
    }

    const classId = ctx.classDoc._id;
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- per-guardian links are classroom-bounded
    const existing = await ctx.db
      .query("guardianStudentLinks")
      .withIndex("by_class_guardian", (q) =>
        q.eq("classId", classId).eq("guardianUserId", args.guardianUserId),
      )
      .collect();

    const desired = new Set(uniqueStudentIds);
    const existingByStudent = new Map(existing.map((link) => [link.studentUserId, link] as const));

    for (const link of existing) {
      if (!desired.has(link.studentUserId)) {
        await ctx.db.delete("guardianStudentLinks", link._id);
      }
    }

    const now = Date.now();
    for (const studentUserId of uniqueStudentIds) {
      if (existingByStudent.has(studentUserId)) continue;
      await ctx.db.insert("guardianStudentLinks", {
        classId,
        guardianUserId: args.guardianUserId,
        studentUserId,
        createdAt: now,
        createdBy: ctx.userId,
      });
    }

    return null;
  },
});

/**
 * Change a class member's role (owners/teachers only, target must be strictly below).
 * Revokes all scoped class membership roles, then assigns the new role.
 */
export const setRole = entitledClassMutation({
  args: {
    userId: v.id("users"),
    role: memberListRoleValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "memberSetRole", { key: ctx.userId, throws: true });
    if (args.userId === ctx.userId) {
      throw new Error("You cannot change your own role");
    }
    if (!isJoinCodeRole(args.role)) {
      throw new Error("Invalid role");
    }
    const newRole: JoinCodeRole = args.role;

    const actorRoleEntries = await authz.getUserRoles(ctx, ctx.userId, ctx.scope);
    const actorRole = pickHighestClassRole(
      actorRoleEntries.map((entry: { role: string }) => entry.role).filter(isClassRole),
    );
    if (!actorRole || !canManageClassRoles(actorRole)) {
      throw new Error("Only owners and teachers can change roles");
    }
    if (!isStrictlyBelow(actorRole, newRole)) {
      throw new Error("You cannot assign a role at or above your own");
    }

    const targetRoleEntries = await authz.getUserRoles(ctx, args.userId, ctx.scope);
    const targetClassRoles = targetRoleEntries
      .map((entry: { role: string }) => entry.role)
      .filter(isClassRole);
    const fromRole = pickHighestClassRole(targetClassRoles);
    if (!fromRole) {
      throw new Error("Person is not in this class");
    }
    if (!isStrictlyBelow(actorRole, fromRole)) {
      throw new Error("You can only change roles of people below you");
    }
    if (fromRole === newRole) {
      return null;
    }

    const removePermission = REMOVE_PERMISSION_BY_ROLE[fromRole];
    if (!removePermission) {
      throw new Error("This person's role cannot be changed");
    }
    await ctx.require(removePermission);

    const invitePermission = JOIN_CODE_INVITE_PERMISSION_BY_ROLE[newRole];
    await ctx.require(invitePermission);

    if (fromRole === "guardian" || fromRole === "student") {
      await clearLinksForUser(ctx, ctx.classDoc._id, args.userId);
    }

    // Drop every scoped class membership role so the member keeps a single role.
    const uniqueClassRoles = [...new Set<ClassRole>(targetClassRoles)];
    for (const role of uniqueClassRoles) {
      await authz.revokeRole(ctx, args.userId, role, ctx.scope);
    }
    await authz.assignRole(ctx, args.userId, newRole, ctx.scope);
    return null;
  },
});
