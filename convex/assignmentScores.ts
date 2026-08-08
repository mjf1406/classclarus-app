import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { classScope } from "./lib/authzModel.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import { getClassRoleForUser, listLinkedStudentsForGuardian } from "./lib/guardianLinks.js";
import { rateLimiter } from "./lib/rateLimiter.js";

const sectionScoreValidator = v.object({
  sectionKey: v.string(),
  pointsEarned: v.optional(v.number()),
  selectedLevelKey: v.optional(v.string()),
  checkedItemKeys: v.optional(v.array(v.string())),
});

const assignmentScoreValidator = v.object({
  _id: v.id("assignmentScores"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  assignmentId: v.id("assignments"),
  studentUserId: v.id("users"),
  totalPointsEarned: v.optional(v.number()),
  sectionScores: v.optional(v.array(sectionScoreValidator)),
  excused: v.boolean(),
  updatedAt: v.number(),
  updatedBy: v.id("users"),
});

type SectionScoreInput = {
  sectionKey: string;
  pointsEarned?: number;
  selectedLevelKey?: string;
  checkedItemKeys?: string[];
};

type NormalizedScorePayload = {
  totalPointsEarned?: number;
  sectionScores?: SectionScoreInput[];
  excused: boolean;
  isEmpty: boolean;
};

async function requireAssignmentInClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  assignmentId: Id<"assignments">,
): Promise<Doc<"assignments">> {
  const assignment = await ctx.db.get("assignments", assignmentId);
  if (!assignment || assignment.classId !== classId) {
    throw new ConvexError({
      code: "ASSIGNMENT_UNAVAILABLE",
      message: "Assignment not found or access denied",
    });
  }
  return assignment;
}

async function requireStudentInClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
  studentUserId: Id<"users">,
): Promise<void> {
  const role = await getClassRoleForUser(ctx, studentUserId, classScope(classId));
  if (role !== "student") {
    throw new Error("Person must be a student in this class");
  }
}

function assertFinitePoints(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function clampPoints(value: number, max: number, label: string): number {
  const n = assertFinitePoints(value, label);
  if (n < 0 || n > max) {
    throw new Error(`${label} must be between 0 and ${max}`);
  }
  return n;
}

function normalizeScorePayload(
  assignment: Doc<"assignments">,
  args: {
    totalPointsEarned?: number;
    sectionScores?: SectionScoreInput[];
    excused?: boolean;
    clear?: boolean;
  },
): NormalizedScorePayload {
  if (args.clear === true) {
    return { excused: false, isEmpty: true };
  }

  const excused = args.excused === true;

  if (assignment.scoringMode === "total") {
    const max = assignment.totalPoints ?? 0;
    if (args.totalPointsEarned === undefined) {
      return { excused, isEmpty: !excused };
    }
    return {
      totalPointsEarned: clampPoints(args.totalPointsEarned, max, "Total points"),
      excused,
      isEmpty: false,
    };
  }

  const sections = assignment.sections ?? [];
  const sectionByKey = new Map(sections.map((section) => [section.key, section]));
  const incoming = args.sectionScores ?? [];
  const normalized: SectionScoreInput[] = [];

  for (const entry of incoming) {
    const section = sectionByKey.get(entry.sectionKey);
    if (!section) {
      continue;
    }

    if (section.type === "points") {
      if (entry.pointsEarned === undefined) {
        continue;
      }
      const max = section.maxPoints ?? 0;
      normalized.push({
        sectionKey: section.key,
        pointsEarned: clampPoints(entry.pointsEarned, max, `"${section.name}" points`),
      });
      continue;
    }

    if (section.type === "rubricLevels") {
      const levelKey = entry.selectedLevelKey?.trim();
      if (!levelKey) {
        continue;
      }
      const level = (section.levels ?? []).find((item) => item.key === levelKey);
      if (!level) {
        throw new Error(`Invalid rubric level for "${section.name}"`);
      }
      normalized.push({
        sectionKey: section.key,
        selectedLevelKey: level.key,
      });
      continue;
    }

    // rubricCheckboxes
    const keys = entry.checkedItemKeys ?? [];
    const validKeys = new Set((section.items ?? []).map((item) => item.key));
    const checkedItemKeys = [...new Set(keys.filter((key) => validKeys.has(key)))];
    if (checkedItemKeys.length === 0) {
      continue;
    }
    normalized.push({
      sectionKey: section.key,
      checkedItemKeys,
    });
  }

  return {
    sectionScores: normalized,
    excused,
    isEmpty: normalized.length === 0 && !excused,
  };
}

function toPublicScore(score: Doc<"assignmentScores">) {
  return {
    _id: score._id,
    _creationTime: score._creationTime,
    classId: score.classId,
    assignmentId: score.assignmentId,
    studentUserId: score.studentUserId,
    totalPointsEarned: score.totalPointsEarned,
    sectionScores: score.sectionScores,
    excused: score.excused === true,
    updatedAt: score.updatedAt,
    updatedBy: score.updatedBy,
  };
}

/** Staff-only list of scores for an assignment. */
export const listScores = classQuery({
  args: {
    assignmentId: v.id("assignments"),
  },
  returns: v.array(assignmentScoreValidator),
  handler: async (ctx, args) => {
    await ctx.require("assignments:manage");
    const classId = ctx.classDoc._id;
    await requireAssignmentInClass(ctx, classId, args.assignmentId);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- assignment-bounded list
    const scores = await ctx.db
      .query("assignmentScores")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", args.assignmentId))
      .collect();
    return scores.map(toPublicScore);
  },
});

/**
 * Student/guardian read of one released score. Returns null when scores are
 * not released, the viewer is not in the personal audience for that student,
 * or no score row exists.
 */
export const getReleasedScore = classQuery({
  args: {
    assignmentId: v.id("assignments"),
    studentUserId: v.id("users"),
  },
  returns: v.union(assignmentScoreValidator, v.null()),
  handler: async (ctx, args) => {
    const classId = ctx.classDoc._id;
    const assignment = await requireAssignmentInClass(ctx, classId, args.assignmentId);
    if (assignment.scoresReleased !== true) {
      return null;
    }

    // Staff use listScores; this endpoint is for students/guardians only.
    if (await ctx.can("students:read")) {
      return null;
    }

    const role = await getClassRoleForUser(ctx, ctx.userId, classScope(classId));
    if (role === "student") {
      if (args.studentUserId !== ctx.userId) {
        return null;
      }
    } else if (role === "guardian") {
      const linked = await listLinkedStudentsForGuardian(ctx, classId, ctx.userId);
      if (!linked.some((student) => student.userId === args.studentUserId)) {
        return null;
      }
    } else {
      return null;
    }

    const score = await ctx.db
      .query("assignmentScores")
      .withIndex("by_assignment_student", (q) =>
        q.eq("assignmentId", args.assignmentId).eq("studentUserId", args.studentUserId),
      )
      .unique();
    return score ? toPublicScore(score) : null;
  },
});

/**
 * Upsert one student's score. An empty/cleared payload deletes the row.
 */
export const upsertScore = classMutation({
  args: {
    assignmentId: v.id("assignments"),
    studentUserId: v.id("users"),
    totalPointsEarned: v.optional(v.number()),
    sectionScores: v.optional(v.array(sectionScoreValidator)),
    excused: v.optional(v.boolean()),
    clear: v.optional(v.boolean()),
  },
  returns: v.union(v.id("assignmentScores"), v.null()),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "assignmentScoreUpsert", { key: ctx.userId, throws: true });
    await ctx.require("assignments:manage");

    const classId = ctx.classDoc._id;
    const assignment = await requireAssignmentInClass(ctx, classId, args.assignmentId);
    await requireStudentInClass(ctx, classId, args.studentUserId);

    const payload = normalizeScorePayload(assignment, {
      totalPointsEarned: args.totalPointsEarned,
      sectionScores: args.sectionScores,
      excused: args.excused,
      clear: args.clear,
    });

    const existing = await ctx.db
      .query("assignmentScores")
      .withIndex("by_assignment_student", (q) =>
        q.eq("assignmentId", args.assignmentId).eq("studentUserId", args.studentUserId),
      )
      .unique();

    if (payload.isEmpty) {
      if (existing) {
        await ctx.db.delete("assignmentScores", existing._id);
      }
      return null;
    }

    const now = Date.now();
    const next = {
      classId,
      assignmentId: args.assignmentId,
      studentUserId: args.studentUserId,
      ...(payload.totalPointsEarned !== undefined
        ? { totalPointsEarned: payload.totalPointsEarned }
        : {}),
      ...(payload.sectionScores !== undefined ? { sectionScores: payload.sectionScores } : {}),
      excused: payload.excused,
      updatedAt: now,
      updatedBy: ctx.userId,
    };

    if (existing) {
      await ctx.db.replace("assignmentScores", existing._id, next);
      return existing._id;
    }

    return await ctx.db.insert("assignmentScores", next);
  },
});

/** Delete one student's score document. */
export const clearScore = classMutation({
  args: {
    assignmentId: v.id("assignments"),
    studentUserId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "assignmentScoreClear", { key: ctx.userId, throws: true });
    await ctx.require("assignments:manage");

    const classId = ctx.classDoc._id;
    await requireAssignmentInClass(ctx, classId, args.assignmentId);

    const existing = await ctx.db
      .query("assignmentScores")
      .withIndex("by_assignment_student", (q) =>
        q.eq("assignmentId", args.assignmentId).eq("studentUserId", args.studentUserId),
      )
      .unique();
    if (existing) {
      await ctx.db.delete("assignmentScores", existing._id);
    }
    return null;
  },
});

/** Assignment-wide release / unrelease of scores. */
export const setScoresReleased = classMutation({
  args: {
    assignmentId: v.id("assignments"),
    released: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "assignmentScoresSetReleased", {
      key: ctx.userId,
      throws: true,
    });
    await ctx.require("assignments:manage");

    const classId = ctx.classDoc._id;
    await requireAssignmentInClass(ctx, classId, args.assignmentId);
    await ctx.db.patch("assignments", args.assignmentId, {
      scoresReleased: args.released,
      updatedAt: Date.now(),
    });
    return null;
  },
});
