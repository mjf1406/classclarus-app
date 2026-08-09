import { v } from "convex/values";

import { APP_CONFIG } from "./appConfig.js";
import { components } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { classScope } from "./lib/authzModel.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import { shouldAutoSetRazRti } from "./lib/razAutoRti.js";
import { isRazLevel } from "./lib/razLevels.js";
import { rateLimiter } from "./lib/rateLimiter.js";

const razResultValidator = v.union(
  v.literal("level_up"),
  v.literal("stay"),
  v.literal("level_down"),
);

const razManualStatusValidator = v.union(v.literal("rti"), v.literal("pending"));

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

    const autoRti = shouldAutoSetRazRti(args.result, previousResult);

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
      manualStatus: autoRti ? "rti" : undefined,
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
        ...(autoRti ? { autoRti: "true" } : {}),
      },
    });

    return assessmentId;
  },
});

/**
 * Set or clear a student's manual RAZ status override (RTI / pending).
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
      args.manualStatus === "rti" ? "RTI" : args.manualStatus === "pending" ? "Pending" : "Auto";

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
