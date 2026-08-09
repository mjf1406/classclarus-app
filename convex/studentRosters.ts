import { v } from "convex/values";

import { APP_CONFIG } from "./appConfig.js";
import { authz } from "./authz.js";
import { components } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { classScope } from "./lib/authzModel.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import {
  ensureStudentRosterRow,
  ensureStudentRostersForUsers,
  GENDER_VALUES,
  PRONOUN_VALUES,
  renumberStudentRosters,
  type GenderValue,
  type PronounValue,
} from "./lib/studentRosters.js";
import { resolveUserImageUrl } from "./lib/userImage.js";

const genderValidator = v.union(
  v.literal("male"),
  v.literal("female"),
  v.literal("transMale"),
  v.literal("transFemale"),
  v.literal("nonBinary"),
  v.literal("selfDescribe"),
  v.literal("preferNotToSay"),
);

const pronounsValidator = v.union(
  v.literal("heHim"),
  v.literal("sheHer"),
  v.literal("theyThem"),
  v.literal("heThey"),
  v.literal("sheThey"),
  v.literal("useNameOnly"),
  v.literal("askSelfDescribe"),
  v.literal("preferNotToSay"),
);

const rosterEntryValidator = v.object({
  userId: v.id("users"),
  rosterNumber: v.number(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  email: v.optional(v.string()),
  gender: v.optional(genderValidator),
  genderSelfDescribe: v.optional(v.string()),
  pronouns: v.optional(pronounsValidator),
  pronounsSelfDescribe: v.optional(v.string()),
  role: v.literal("student"),
});

async function listStudentUserIds(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
): Promise<Array<Id<"users">>> {
  const scope = classScope(classId);
  const users = await ctx.runQuery(components.authz.queries.getUsersWithRole, {
    tenantId: APP_CONFIG.authzTenantId,
    role: "student",
    scope,
  });
  return users.map((entry: { userId: string }) => entry.userId as Id<"users">);
}

function isGender(value: string): value is GenderValue {
  return (GENDER_VALUES as ReadonlyArray<string>).includes(value);
}

function isPronoun(value: string): value is PronounValue {
  return (PRONOUN_VALUES as ReadonlyArray<string>).includes(value);
}

/**
 * List students with roster fields. Always includes email for students:read viewers.
 * Sorted by rosterNumber ascending. Students without a roster row are omitted until
 * `ensureForClass` runs (page mounts ensure).
 */
export const list = classQuery({
  args: {},
  returns: v.array(rosterEntryValidator),
  handler: async (ctx) => {
    await ctx.require("students:read");
    const classId = ctx.classDoc._id;
    const studentUserIds = await listStudentUserIds(ctx, classId);
    const studentSet = new Set(studentUserIds);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded roster
    const rosterRows = await ctx.db
      .query("studentRosters")
      .withIndex("by_classId_rosterNumber", (q) => q.eq("classId", classId))
      .collect();

    const entries: Array<{
      userId: Id<"users">;
      rosterNumber: number;
      firstName?: string;
      lastName?: string;
      name?: string;
      image?: string;
      email?: string;
      gender?: GenderValue;
      genderSelfDescribe?: string;
      pronouns?: PronounValue;
      pronounsSelfDescribe?: string;
      role: "student";
    }> = [];

    for (const row of rosterRows) {
      if (!studentSet.has(row.userId)) continue;
      const user = await ctx.db.get("users", row.userId);
      if (!user) continue;
      entries.push({
        userId: row.userId,
        rosterNumber: row.rosterNumber,
        firstName: row.firstName,
        lastName: row.lastName,
        name: user.name,
        image: await resolveUserImageUrl(ctx, user),
        email: user.email,
        gender: row.gender,
        genderSelfDescribe: row.genderSelfDescribe,
        pronouns: row.pronouns,
        pronounsSelfDescribe: row.pronounsSelfDescribe,
        role: "student",
      });
    }

    entries.sort((a, b) => a.rosterNumber - b.rosterNumber);
    return entries;
  },
});

/**
 * Idempotent backfill: create roster rows for students missing one,
 * ordered alphabetically by users.name among the missing set.
 */
export const ensureForClass = classMutation({
  args: {},
  returns: v.object({ created: v.number() }),
  handler: async (ctx) => {
    await rateLimiter.limit(ctx, "rosterEnsure", { key: ctx.userId, throws: true });
    await ctx.require("students:read");
    const classId = ctx.classDoc._id;
    const studentUserIds = await listStudentUserIds(ctx, classId);
    const created = await ensureStudentRostersForUsers(ctx, classId, studentUserIds);
    return { created };
  },
});

export const updateFields = classMutation({
  args: {
    userId: v.id("users"),
    firstName: v.optional(v.union(v.string(), v.null())),
    lastName: v.optional(v.union(v.string(), v.null())),
    gender: v.optional(v.union(genderValidator, v.null())),
    genderSelfDescribe: v.optional(v.union(v.string(), v.null())),
    pronouns: v.optional(v.union(pronounsValidator, v.null())),
    pronounsSelfDescribe: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "rosterUpdateFields", { key: ctx.userId, throws: true });
    await ctx.require("students:update");
    const classId = ctx.classDoc._id;

    const roles = await authz.getUserRoles(ctx, args.userId, ctx.scope);
    const isStudent = roles.some((entry: { role: string }) => entry.role === "student");
    if (!isStudent) {
      throw new Error("Person is not a student in this class");
    }

    await ensureStudentRosterRow(ctx, classId, args.userId);
    const row = await ctx.db
      .query("studentRosters")
      .withIndex("by_classId_userId", (q) => q.eq("classId", classId).eq("userId", args.userId))
      .unique();
    if (!row) {
      throw new Error("Roster row missing");
    }

    const patch: {
      firstName?: string | undefined;
      lastName?: string | undefined;
      gender?: GenderValue | undefined;
      genderSelfDescribe?: string | undefined;
      pronouns?: PronounValue | undefined;
      pronounsSelfDescribe?: string | undefined;
    } = {};

    if (args.firstName !== undefined) {
      patch.firstName = args.firstName === null ? undefined : args.firstName.trim() || undefined;
    }
    if (args.lastName !== undefined) {
      patch.lastName = args.lastName === null ? undefined : args.lastName.trim() || undefined;
    }

    if (args.gender !== undefined) {
      if (args.gender === null) {
        patch.gender = undefined;
        patch.genderSelfDescribe = undefined;
      } else {
        if (!isGender(args.gender)) throw new Error("Invalid gender");
        patch.gender = args.gender;
        if (args.gender !== "selfDescribe") {
          patch.genderSelfDescribe = undefined;
        }
      }
    }

    if (args.genderSelfDescribe !== undefined) {
      const nextGender = patch.gender ?? row.gender;
      if (nextGender === "selfDescribe") {
        patch.genderSelfDescribe =
          args.genderSelfDescribe === null
            ? undefined
            : args.genderSelfDescribe.trim() || undefined;
      } else if (args.gender === undefined) {
        // Ignore self-describe text unless gender is selfDescribe.
        patch.genderSelfDescribe = undefined;
      }
    }

    if (args.pronouns !== undefined) {
      if (args.pronouns === null) {
        patch.pronouns = undefined;
        patch.pronounsSelfDescribe = undefined;
      } else {
        if (!isPronoun(args.pronouns)) throw new Error("Invalid pronouns");
        patch.pronouns = args.pronouns;
        if (args.pronouns !== "askSelfDescribe") {
          patch.pronounsSelfDescribe = undefined;
        }
      }
    }

    if (args.pronounsSelfDescribe !== undefined) {
      const nextPronouns = patch.pronouns ?? row.pronouns;
      if (nextPronouns === "askSelfDescribe") {
        patch.pronounsSelfDescribe =
          args.pronounsSelfDescribe === null
            ? undefined
            : args.pronounsSelfDescribe.trim() || undefined;
      } else if (args.pronouns === undefined) {
        patch.pronounsSelfDescribe = undefined;
      }
    }

    const effectiveGender = patch.gender !== undefined ? patch.gender : row.gender;
    if (effectiveGender === "selfDescribe") {
      const text =
        patch.genderSelfDescribe !== undefined ? patch.genderSelfDescribe : row.genderSelfDescribe;
      if (!text?.trim()) {
        throw new Error("Self-described gender requires a short description");
      }
    }

    const effectivePronouns = patch.pronouns !== undefined ? patch.pronouns : row.pronouns;
    if (effectivePronouns === "askSelfDescribe") {
      const text =
        patch.pronounsSelfDescribe !== undefined
          ? patch.pronounsSelfDescribe
          : row.pronounsSelfDescribe;
      if (!text?.trim()) {
        throw new Error("Self-described pronouns require a short description");
      }
    }

    const changedFields = Object.keys(patch);
    await ctx.db.patch("studentRosters", row._id, patch);
    if (changedFields.length > 0) {
      await recordClassActivity(ctx, {
        classId,
        actorUserId: ctx.userId,
        action: "update",
        resourceType: "roster",
        resourceId: args.userId,
        summary: "Updated student roster fields",
        summaryKey: "activitySummary_updatedStudentRosterFields",
        metadata: {
          studentUserId: args.userId,
          fields: changedFields.join(","),
        },
      });
    }
    return null;
  },
});

/**
 * Rewrite roster numbers from an ordered list of student userIds (1-based dense).
 */
export const reorder = classMutation({
  args: {
    userIds: v.array(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "rosterReorder", { key: ctx.userId, throws: true });
    await ctx.require("students:update");
    const classId = ctx.classDoc._id;

    const studentUserIds = await listStudentUserIds(ctx, classId);
    const studentSet = new Set(studentUserIds);
    if (args.userIds.length !== studentUserIds.length) {
      throw new Error("Reorder list must include every student exactly once");
    }
    const seen = new Set<string>();
    for (const userId of args.userIds) {
      if (!studentSet.has(userId)) {
        throw new Error("Reorder list contains a non-student");
      }
      if (seen.has(userId)) {
        throw new Error("Reorder list has duplicates");
      }
      seen.add(userId);
    }

    for (const userId of args.userIds) {
      await ensureStudentRosterRow(ctx, classId, userId);
    }

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded roster
    const rows = await ctx.db
      .query("studentRosters")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();
    const byUser = new Map(rows.map((row) => [row.userId, row] as const));

    // Two-phase renumber to avoid unique-index collisions if any exist later.
    for (let i = 0; i < args.userIds.length; i++) {
      const row = byUser.get(args.userIds[i]);
      if (!row) continue;
      await ctx.db.patch("studentRosters", row._id, {
        rosterNumber: -(i + 1),
      });
    }
    for (let i = 0; i < args.userIds.length; i++) {
      const row = byUser.get(args.userIds[i]);
      if (!row) continue;
      await ctx.db.patch("studentRosters", row._id, {
        rosterNumber: i + 1,
      });
    }

    await renumberStudentRosters(ctx, classId);
    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "roster",
      resourceId: classId,
      summary: "Reordered student roster",
      summaryKey: "activitySummary_reorderedStudentRoster",
      metadata: {
        studentCount: String(args.userIds.length),
      },
    });
    return null;
  },
});
