import { v } from "convex/values";

import { APP_CONFIG } from "./appConfig.js";
import { components } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { classScope } from "./lib/authzModel.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import { assertPersonalStudentAccess, resolvePersonalStudentIds } from "./lib/guardianLinks.js";
import { resolveRazAutoManualStatus } from "./lib/razAutoRti.js";
import { isRazLevel } from "./lib/razLevels.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import { resolveUserImageUrl } from "./lib/userImage.js";

const razResultValidator = v.union(
  v.literal("level_up"),
  v.literal("stay"),
  v.literal("level_down"),
);

const razManualStatusValidator = v.union(
  v.literal("rti"),
  v.literal("pending"),
  v.literal("ineligible"),
);

const levelEntryValidator = v.object({
  studentUserId: v.id("users"),
  initialLevel: v.string(),
  currentLevel: v.string(),
  /** Latest assessment `assessedAt`, or null when none recorded yet. */
  lastAssessedAt: v.union(v.number(), v.null()),
  /** Latest assessment result, or null when none recorded yet. */
  lastAssessmentResult: v.union(razResultValidator, v.null()),
  /**
   * Anchor for the reassessment schedule window:
   * last assessment date, else when the level row was last updated (initial setup).
   */
  scheduleAnchorAt: v.number(),
  /** Teacher override / auto-RTI; null when schedule-derived status should be used. */
  manualStatus: v.union(razManualStatusValidator, v.null()),
});

const assessmentEntryValidator = v.object({
  _id: v.id("razAssessments"),
  studentUserId: v.id("users"),
  assessedAt: v.number(),
  readAccuracy: v.number(),
  retellScore: v.union(v.number(), v.null()),
  respondScore: v.number(),
  result: razResultValidator,
  level: v.string(),
  note: v.union(v.string(), v.null()),
});

/** Personal history — omits staff-only notes. */
const personalAssessmentEntryValidator = v.object({
  _id: v.id("razAssessments"),
  studentUserId: v.id("users"),
  assessedAt: v.number(),
  readAccuracy: v.number(),
  retellScore: v.union(v.number(), v.null()),
  respondScore: v.number(),
  result: razResultValidator,
  level: v.string(),
});

const personalStudentValidator = v.object({
  userId: v.id("users"),
  rosterNumber: v.number(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  email: v.optional(v.string()),
  initialLevel: v.union(v.string(), v.null()),
  currentLevel: v.union(v.string(), v.null()),
  lastAssessedAt: v.union(v.number(), v.null()),
  lastAssessmentResult: v.union(razResultValidator, v.null()),
  scheduleAnchorAt: v.union(v.number(), v.null()),
  manualStatus: v.union(razManualStatusValidator, v.null()),
  assessmentCount: v.number(),
  levelUpPct: v.number(),
  stayPct: v.number(),
  levelDownPct: v.number(),
});

function resultMixPercents(results: Array<"level_up" | "stay" | "level_down">): {
  assessmentCount: number;
  levelUpPct: number;
  stayPct: number;
  levelDownPct: number;
} {
  const assessmentCount = results.length;
  if (assessmentCount === 0) {
    return { assessmentCount: 0, levelUpPct: 0, stayPct: 0, levelDownPct: 0 };
  }
  let levelUp = 0;
  let stay = 0;
  let levelDown = 0;
  for (const result of results) {
    if (result === "level_up") levelUp += 1;
    else if (result === "stay") stay += 1;
    else levelDown += 1;
  }
  return {
    assessmentCount,
    levelUpPct: Math.round((levelUp / assessmentCount) * 100),
    stayPct: Math.round((stay / assessmentCount) * 100),
    levelDownPct: Math.round((levelDown / assessmentCount) * 100),
  };
}

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
 * Sparse list of RAZ levels for the class.
 * Students without a row still need an initial level.
 * `currentLevel` falls back to `initialLevel` when unset.
 */
export const listInitialLevels = classQuery({
  args: {},
  returns: v.array(levelEntryValidator),
  handler: async (ctx) => {
    await ctx.require("raz:read");
    const classId = ctx.classDoc._id;

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded RAZ levels
    const rows = await ctx.db
      .query("razStudentLevels")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded RAZ assessments
    const assessments = await ctx.db
      .query("razAssessments")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();

    const lastAssessmentByStudent = new Map<
      Id<"users">,
      { assessedAt: number; result: "level_up" | "stay" | "level_down" }
    >();
    for (const assessment of assessments) {
      const prev = lastAssessmentByStudent.get(assessment.studentUserId);
      if (prev === undefined || assessment.assessedAt > prev.assessedAt) {
        lastAssessmentByStudent.set(assessment.studentUserId, {
          assessedAt: assessment.assessedAt,
          result: assessment.result,
        });
      }
    }

    return rows.map((row) => {
      const last = lastAssessmentByStudent.get(row.studentUserId) ?? null;
      const lastAssessedAt = last?.assessedAt ?? null;
      return {
        studentUserId: row.studentUserId,
        initialLevel: row.initialLevel,
        currentLevel: row.currentLevel ?? row.initialLevel,
        lastAssessedAt,
        lastAssessmentResult: last?.result ?? null,
        scheduleAnchorAt: lastAssessedAt ?? row.updatedAt,
        manualStatus: row.manualStatus ?? null,
      };
    });
  },
});

/**
 * Sparse list of recorded RAZ assessments for the class (newest first).
 * Classroom-bounded; used for per-student history under expanded roster rows.
 */
export const listAssessments = classQuery({
  args: {},
  returns: v.array(assessmentEntryValidator),
  handler: async (ctx) => {
    await ctx.require("raz:read");
    const classId = ctx.classDoc._id;

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded RAZ assessments
    const rows = await ctx.db
      .query("razAssessments")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();

    rows.sort((a, b) => b.assessedAt - a.assessedAt);

    return rows.map((row) => ({
      _id: row._id,
      studentUserId: row.studentUserId,
      assessedAt: row.assessedAt,
      readAccuracy: row.readAccuracy,
      retellScore: row.retellScore ?? null,
      respondScore: row.respondScore,
      result: row.result,
      level: row.level,
      note: row.note ?? null,
    }));
  },
});

/**
 * Personal/read audience: self (student) or linked students (guardian).
 * Includes level summary + result mix percentages. Omits assessment notes.
 */
export const forAudience = classQuery({
  args: {},
  returns: v.array(personalStudentValidator),
  handler: async (ctx) => {
    await ctx.require("raz:read");
    const classId = ctx.classDoc._id;
    const studentUserIds = await resolvePersonalStudentIds(ctx, classId);
    if (studentUserIds.length === 0) {
      return [];
    }

    const entries: Array<{
      userId: Id<"users">;
      rosterNumber: number;
      firstName?: string;
      lastName?: string;
      name?: string;
      image?: string;
      email?: string;
      initialLevel: string | null;
      currentLevel: string | null;
      lastAssessedAt: number | null;
      lastAssessmentResult: "level_up" | "stay" | "level_down" | null;
      scheduleAnchorAt: number | null;
      manualStatus: "rti" | "pending" | "ineligible" | null;
      assessmentCount: number;
      levelUpPct: number;
      stayPct: number;
      levelDownPct: number;
    }> = [];

    for (const studentUserId of studentUserIds) {
      const roster = await ctx.db
        .query("studentRosters")
        .withIndex("by_classId_userId", (q) => q.eq("classId", classId).eq("userId", studentUserId))
        .unique();
      if (!roster) continue;
      const user = await ctx.db.get("users", studentUserId);
      if (!user) continue;

      const levelRow = await ctx.db
        .query("razStudentLevels")
        .withIndex("by_class_student", (q) =>
          q.eq("classId", classId).eq("studentUserId", studentUserId),
        )
        .unique();

      // eslint-disable-next-line @convex-dev/no-collect-in-query -- per-student RAZ history is school-year bounded
      const assessments = await ctx.db
        .query("razAssessments")
        .withIndex("by_class_student", (q) =>
          q.eq("classId", classId).eq("studentUserId", studentUserId),
        )
        .collect();

      let lastAssessedAt: number | null = null;
      let lastAssessmentResult: "level_up" | "stay" | "level_down" | null = null;
      for (const assessment of assessments) {
        if (lastAssessedAt === null || assessment.assessedAt > lastAssessedAt) {
          lastAssessedAt = assessment.assessedAt;
          lastAssessmentResult = assessment.result;
        }
      }

      const mix = resultMixPercents(assessments.map((a) => a.result));
      const initialLevel = levelRow?.initialLevel ?? null;
      const currentLevel = levelRow ? (levelRow.currentLevel ?? levelRow.initialLevel) : null;
      const scheduleAnchorAt = levelRow !== null ? (lastAssessedAt ?? levelRow.updatedAt) : null;

      entries.push({
        userId: studentUserId,
        rosterNumber: roster.rosterNumber,
        firstName: roster.firstName,
        lastName: roster.lastName,
        name: user.name,
        image: await resolveUserImageUrl(ctx, user),
        email: user.email,
        initialLevel,
        currentLevel,
        lastAssessedAt,
        lastAssessmentResult,
        scheduleAnchorAt,
        manualStatus: levelRow?.manualStatus ?? null,
        ...mix,
      });
    }

    entries.sort((a, b) => a.rosterNumber - b.rosterNumber);
    return entries;
  },
});

/**
 * Assessment history for one personal-audience student (newest first).
 * Omits staff-only notes.
 */
export const assessmentHistoryForAudience = classQuery({
  args: {
    studentUserId: v.id("users"),
  },
  returns: v.array(personalAssessmentEntryValidator),
  handler: async (ctx, args) => {
    await ctx.require("raz:read");
    const classId = ctx.classDoc._id;
    await assertPersonalStudentAccess(ctx, classId, args.studentUserId);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- per-student RAZ history is school-year bounded
    const rows = await ctx.db
      .query("razAssessments")
      .withIndex("by_class_student", (q) =>
        q.eq("classId", classId).eq("studentUserId", args.studentUserId),
      )
      .collect();

    rows.sort((a, b) => b.assessedAt - a.assessedAt);

    return rows.map((row) => ({
      _id: row._id,
      studentUserId: row.studentUserId,
      assessedAt: row.assessedAt,
      readAccuracy: row.readAccuracy,
      retellScore: row.retellScore ?? null,
      respondScore: row.respondScore,
      result: row.result,
      level: row.level,
    }));
  },
});

/**
 * Upsert a student's RAZ initial level. Requires raz:manage (teacher+).
 * On insert, also sets currentLevel. On patch, leaves existing currentLevel alone.
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
        currentLevel: args.initialLevel,
        updatedAt: now,
        updatedBy: ctx.userId,
      });
    }

    return null;
  },
});

/**
 * Record a RAZ assessment and update the student's current level.
 * Requires raz:manage. Does not change initialLevel.
 */
export const recordAssessment = classMutation({
  args: {
    studentUserId: v.id("users"),
    assessedAt: v.number(),
    readAccuracy: v.number(),
    retellScore: v.optional(v.number()),
    respondScore: v.number(),
    result: razResultValidator,
    level: v.string(),
    note: v.optional(v.string()),
  },
  returns: v.id("razAssessments"),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "razRecordAssessment", { key: ctx.userId, throws: true });
    await ctx.require("raz:manage");
    const classId = ctx.classDoc._id;

    if (!Number.isFinite(args.readAccuracy) || args.readAccuracy < 0 || args.readAccuracy > 100) {
      throw new Error("Read accuracy must be between 0 and 100");
    }
    if (!Number.isFinite(args.respondScore) || args.respondScore < 0 || args.respondScore > 5) {
      throw new Error("Respond score must be between 0 and 5");
    }
    if (args.retellScore !== undefined) {
      if (!Number.isFinite(args.retellScore) || args.retellScore < 0 || args.retellScore > 18) {
        throw new Error("Retell score must be between 0 and 18");
      }
    }
    if (!Number.isFinite(args.assessedAt)) {
      throw new Error("Invalid assessment date");
    }
    if (!isRazLevel(args.level)) {
      throw new Error("Invalid RAZ level");
    }

    const note = args.note?.trim();
    if (note !== undefined && note.length > 2000) {
      throw new Error("Note is too long");
    }

    const studentIds = await listStudentUserIds(ctx, classId);
    if (!studentIds.includes(args.studentUserId)) {
      throw new Error("Person is not a student in this class");
    }

    const levelRow = await ctx.db
      .query("razStudentLevels")
      .withIndex("by_class_student", (q) =>
        q.eq("classId", classId).eq("studentUserId", args.studentUserId),
      )
      .unique();

    if (!levelRow) {
      throw new Error("Set an initial RAZ level before recording an assessment");
    }

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded prior assessments for one student
    const priorAssessments = await ctx.db
      .query("razAssessments")
      .withIndex("by_class_student", (q) =>
        q.eq("classId", classId).eq("studentUserId", args.studentUserId),
      )
      .collect();

    let previousResult: "level_up" | "stay" | "level_down" | null = null;
    let previousAssessedAt = Number.NEGATIVE_INFINITY;
    for (const prior of priorAssessments) {
      if (prior.assessedAt > previousAssessedAt) {
        previousAssessedAt = prior.assessedAt;
        previousResult = prior.result;
      }
    }

    const autoStatus = resolveRazAutoManualStatus({
      level: args.level,
      result: args.result,
      previousResult,
      priorAssessments,
    });

    const now = Date.now();
    const assessmentId = await ctx.db.insert("razAssessments", {
      classId,
      studentUserId: args.studentUserId,
      assessedAt: args.assessedAt,
      readAccuracy: args.readAccuracy,
      retellScore: args.retellScore,
      respondScore: args.respondScore,
      result: args.result,
      level: args.level,
      note: note && note.length > 0 ? note : undefined,
      createdAt: now,
      createdBy: ctx.userId,
    });

    await ctx.db.patch("razStudentLevels", levelRow._id, {
      currentLevel: args.level,
      ...(autoStatus !== null ? { manualStatus: autoStatus } : {}),
      updatedAt: now,
      updatedBy: ctx.userId,
    });

    const resultLabel =
      args.result === "level_up"
        ? "Level up"
        : args.result === "level_down"
          ? "Level down"
          : "Stay";

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "razAssessment",
      resourceId: assessmentId,
      summary: `Recorded RAZ assessment (${resultLabel}) → level ${args.level}`,
      summaryKey: "activitySummary_recordedRazAssessment",
      metadata: {
        result: resultLabel,
        level: args.level,
        targetUserId: args.studentUserId,
        readAccuracy: String(args.readAccuracy),
        respondScore: String(args.respondScore),
        ...(autoStatus === "rti" ? { autoRti: "true" } : {}),
        ...(autoStatus === "ineligible" ? { autoIneligible: "true" } : {}),
      },
    });

    return assessmentId;
  },
});

/**
 * Set or clear a student's manual RAZ status override (RTI / pending / ineligible).
 * Requires raz:manage. Pass null to clear and use schedule-derived status.
 */
export const setManualStatus = classMutation({
  args: {
    studentUserId: v.id("users"),
    manualStatus: v.union(razManualStatusValidator, v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "razSetManualStatus", { key: ctx.userId, throws: true });
    await ctx.require("raz:manage");
    const classId = ctx.classDoc._id;

    const studentIds = await listStudentUserIds(ctx, classId);
    if (!studentIds.includes(args.studentUserId)) {
      throw new Error("Person is not a student in this class");
    }

    const levelRow = await ctx.db
      .query("razStudentLevels")
      .withIndex("by_class_student", (q) =>
        q.eq("classId", classId).eq("studentUserId", args.studentUserId),
      )
      .unique();

    if (!levelRow) {
      throw new Error("Set an initial RAZ level before setting status");
    }

    // Do not bump updatedAt — it anchors the schedule when there is no assessment yet.
    await ctx.db.patch("razStudentLevels", levelRow._id, {
      manualStatus: args.manualStatus ?? undefined,
    });

    const statusLabel =
      args.manualStatus === "rti"
        ? "RTI"
        : args.manualStatus === "pending"
          ? "Pending"
          : args.manualStatus === "ineligible"
            ? "Ineligible"
            : "Auto";

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "razAssessment",
      resourceId: levelRow._id,
      summary: `Set RAZ status to ${statusLabel}`,
      summaryKey: "activitySummary_setRazManualStatus",
      metadata: {
        status: statusLabel,
        targetUserId: args.studentUserId,
      },
    });

    return null;
  },
});
