import { ConvexError, v } from "convex/values";

import { APP_CONFIG } from "./appConfig.js";
import { authz } from "./authz.js";
import { components } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx } from "./_generated/server.js";
import { mutation } from "./_generated/server.js";
import { requireAuthUserId } from "./lib/auth.js";
import { classScope } from "./lib/authzModel.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { clearLinksForUser } from "./lib/guardianLinks.js";
import { clearGroupMembershipForStudent } from "./lib/groupsCleanup.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import { isSeedStudentEmail, planSeedTestStudents } from "./lib/seedTestStudents.js";
import { deleteStudentRosterRow, nextRosterNumber } from "./lib/studentRosters.js";

const MAX_PER_GENDER = 40;
const MAX_TOTAL = 80;

async function requireSiteAdmin(ctx: MutationCtx): Promise<Id<"users">> {
  const userId = await requireAuthUserId(ctx);
  const allowed =
    (await authz.can(ctx, userId, "admin:manageUsers")) ||
    (await authz.can(ctx, userId, "admin:viewFeedback"));
  if (!allowed) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
  return userId;
}

async function removeSeedStudentsFromClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<number> {
  const scope = classScope(classId);
  const students = await ctx.runQuery(components.authz.queries.getUsersWithRole, {
    tenantId: APP_CONFIG.authzTenantId,
    role: "student",
    scope,
  });

  let removed = 0;
  for (const entry of students) {
    const userId = entry.userId as Id<"users">;
    const user = await ctx.db.get("users", userId);
    if (!isSeedStudentEmail(user?.email)) continue;

    await clearLinksForUser(ctx, classId, userId);
    await clearGroupMembershipForStudent(ctx, classId, userId);
    await deleteStudentRosterRow(ctx, classId, userId);
    await authz.offboardUser(ctx, userId, {
      scope,
      removeOverrides: true,
      removeRelationships: true,
      removeAttributes: false,
    });
    await ctx.db.delete("users", userId);
    removed += 1;
  }
  return removed;
}

/**
 * Site-admin tool: create fake student users + roster rows for seating tests.
 * Seeded accounts use `@classclarus.seed` emails and cannot sign in.
 */
export const seedTestStudents = mutation({
  args: {
    classId: v.id("classes"),
    boyCount: v.number(),
    girlCount: v.number(),
    namePrefix: v.optional(v.string()),
    replaceExistingSeed: v.optional(v.boolean()),
  },
  returns: v.object({
    created: v.number(),
    removed: v.number(),
    boyCount: v.number(),
    girlCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const adminUserId = await requireSiteAdmin(ctx);
    await rateLimiter.limit(ctx, "adminSeedTestStudents", {
      key: adminUserId,
      throws: true,
    });

    const boyCount = Math.floor(args.boyCount);
    const girlCount = Math.floor(args.girlCount);
    if (boyCount < 0 || girlCount < 0) {
      throw new ConvexError({
        code: "INVALID_ARGS",
        message: "Boy and girl counts must be zero or greater",
      });
    }
    if (boyCount > MAX_PER_GENDER || girlCount > MAX_PER_GENDER) {
      throw new ConvexError({
        code: "INVALID_ARGS",
        message: `At most ${MAX_PER_GENDER} students per gender`,
      });
    }
    if (boyCount + girlCount === 0) {
      throw new ConvexError({
        code: "INVALID_ARGS",
        message: "Add at least one student",
      });
    }
    if (boyCount + girlCount > MAX_TOTAL) {
      throw new ConvexError({
        code: "INVALID_ARGS",
        message: `At most ${MAX_TOTAL} students per seed`,
      });
    }

    const classDoc = await ctx.db.get("classes", args.classId);
    if (!classDoc) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Class not found",
      });
    }
    if (classDoc.archivedAt !== undefined) {
      throw new ConvexError({
        code: "CLASS_ARCHIVED",
        message: "This class is archived",
      });
    }

    let removed = 0;
    if (args.replaceExistingSeed) {
      removed = await removeSeedStudentsFromClass(ctx, args.classId);
    }

    const scope = classScope(args.classId);
    const plans = planSeedTestStudents({
      classId: args.classId,
      boyCount,
      girlCount,
      namePrefix: args.namePrefix,
      nonce: `${Date.now()}`,
    });

    let rosterNumber = await nextRosterNumber(ctx, args.classId);
    let created = 0;

    for (const plan of plans) {
      const userId = await ctx.db.insert("users", {
        name: plan.displayName,
        email: plan.email,
        isAnonymous: true,
      });
      await authz.assignRole(ctx, userId, "student", scope);
      await ctx.db.insert("studentRosters", {
        classId: args.classId,
        userId,
        rosterNumber,
        firstName: plan.firstName,
        lastName: plan.lastName,
        gender: plan.gender,
        pronouns: plan.pronouns,
        pointsBalance: 0,
        pointsAwarded: 0,
        pointsRemoved: 0,
        pointsRedeemed: 0,
        warningCount: 0,
      });
      rosterNumber += 1;
      created += 1;
    }

    await recordClassActivity(ctx, {
      classId: args.classId,
      actorUserId: adminUserId,
      action: "write",
      resourceType: "member",
      resourceId: args.classId,
      summary: `Seeded ${created} test students (${boyCount} boys, ${girlCount} girls)`,
      summaryKey: "activitySummary_seededTestStudents",
      metadata: {
        count: String(created),
        boyCount: String(boyCount),
        girlCount: String(girlCount),
        removed: String(removed),
      },
    });

    return { created, removed, boyCount, girlCount };
  },
});
