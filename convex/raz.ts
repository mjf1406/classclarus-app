import { v } from "convex/values";

import { APP_CONFIG } from "./appConfig.js";
import { components } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { classScope } from "./lib/authzModel.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import { isRazLevel } from "./lib/razLevels.js";
import { rateLimiter } from "./lib/rateLimiter.js";

const initialLevelEntryValidator = v.object({
  studentUserId: v.id("users"),
  initialLevel: v.string(),
});

async function listStudentUserIds(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
): Promise<Array<Id<"users">>> {
  const users = await ctx.runQuery(components.authz.queries.getUsersWithRole, {
    tenantId: APP_CONFIG.authzTenantId,
    role: "student",
    scope: classScope(classId),
  });
  return users.map((entry: { userId: string }) => entry.userId as Id<"users">);
}

/**
 * Sparse list of RAZ initial levels for the class.
 * Students without a row still need an initial level.
 */
export const listInitialLevels = classQuery({
  args: {},
  returns: v.array(initialLevelEntryValidator),
  handler: async (ctx) => {
    await ctx.require("raz:read");
    const classId = ctx.classDoc._id;

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded RAZ levels
    const rows = await ctx.db
      .query("razStudentLevels")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();

    return rows.map((row) => ({
      studentUserId: row.studentUserId,
      initialLevel: row.initialLevel,
    }));
  },
});

/**
 * Upsert a student's RAZ initial level. Requires raz:manage (teacher+).
 */
export const setInitialLevel = classMutation({
  args: {
    studentUserId: v.id("users"),
    initialLevel: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "razSetInitialLevel", { key: ctx.userId, throws: true });
    await ctx.require("raz:manage");
    const classId = ctx.classDoc._id;

    if (!isRazLevel(args.initialLevel)) {
      throw new Error("Invalid RAZ level");
    }

    const studentIds = await listStudentUserIds(ctx, classId);
    if (!studentIds.includes(args.studentUserId)) {
      throw new Error("Person is not a student in this class");
    }

    const existing = await ctx.db
      .query("razStudentLevels")
      .withIndex("by_class_student", (q) =>
        q.eq("classId", classId).eq("studentUserId", args.studentUserId),
      )
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch("razStudentLevels", existing._id, {
        initialLevel: args.initialLevel,
        updatedAt: now,
        updatedBy: ctx.userId,
      });
    } else {
      await ctx.db.insert("razStudentLevels", {
        classId,
        studentUserId: args.studentUserId,
        initialLevel: args.initialLevel,
        updatedAt: now,
        updatedBy: ctx.userId,
      });
    }

    return null;
  },
});
