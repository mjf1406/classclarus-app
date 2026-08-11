import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import type { GradeScaleSystemKey } from "./lib/gradeScales/defaults.js";
import {
  normalizeGradedSubjectInput,
  type NormalizedGradedSubjectItem,
} from "./lib/gradedSubjects/normalize.js";
import type { GradedSubjectItemInput } from "./lib/gradedSubjects/gradedSubjectSchema.js";

const gradedSubjectItemValidator = v.object({
  assignmentId: v.id("assignments"),
  sectionKey: v.optional(v.string()),
  weight: v.number(),
});

const gradedSubjectItemInputValidator = v.object({
  assignmentId: v.id("assignments"),
  sectionKey: v.optional(v.string()),
  weight: v.number(),
});

const gradedSubjectListItemValidator = v.object({
  _id: v.id("gradedSubjects"),
  _creationTime: v.number(),
  name: v.string(),
  icon: v.optional(v.string()),
  gradeScaleId: v.id("gradeScales"),
  items: v.array(gradedSubjectItemValidator),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const gradedSubjectDetailValidator = v.object({
  _id: v.id("gradedSubjects"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  name: v.string(),
  icon: v.optional(v.string()),
  gradeScaleId: v.id("gradeScales"),
  items: v.array(gradedSubjectItemValidator),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
});

function isSystemScale(doc: Doc<"gradeScales">): boolean {
  return doc.systemKey !== undefined && doc.classId === undefined;
}

async function loadHiddenSystemKeys(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
): Promise<Set<GradeScaleSystemKey>> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- bounded to 4 system keys per class
  const rows = await ctx.db
    .query("gradeScaleHiddenDefaults")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  return new Set(rows.map((row) => row.systemKey));
}

async function requireVisibleGradeScale(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  gradeScaleId: Id<"gradeScales">,
): Promise<Doc<"gradeScales">> {
  const scale = await ctx.db.get("gradeScales", gradeScaleId);
  if (!scale) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Grade scale not found",
    });
  }
  if (isSystemScale(scale)) {
    const hiddenKeys = await loadHiddenSystemKeys(ctx, classId);
    if (hiddenKeys.has(scale.systemKey ?? "standard")) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Grade scale not found",
      });
    }
    return scale;
  }
  if (scale.classId !== classId) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Grade scale not found",
    });
  }
  return scale;
}

async function requireGradedSubject(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  gradedSubjectId: Id<"gradedSubjects">,
): Promise<Doc<"gradedSubjects">> {
  const subject = await ctx.db.get("gradedSubjects", gradedSubjectId);
  if (!subject || subject.classId !== classId) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Graded subject not found",
    });
  }
  return subject;
}

async function validateItemsForClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  items: NormalizedGradedSubjectItem[],
): Promise<void> {
  for (const item of items) {
    const assignment = await ctx.db.get("assignments", item.assignmentId as Id<"assignments">);
    if (!assignment || assignment.classId !== classId) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "Assignment not found",
      });
    }

    if (item.sectionKey) {
      if (assignment.scoringMode !== "sections") {
        throw new ConvexError({
          code: "INVALID_INPUT",
          message: "Section does not exist on assignment",
        });
      }
      const section = (assignment.sections ?? []).find((row) => row.key === item.sectionKey);
      if (!section) {
        throw new ConvexError({
          code: "INVALID_INPUT",
          message: "Section not found",
        });
      }
    }
  }
}

function toListItem(doc: Doc<"gradedSubjects">) {
  return {
    _id: doc._id,
    _creationTime: doc._creationTime,
    name: doc.name,
    icon: doc.icon,
    gradeScaleId: doc.gradeScaleId,
    items: doc.items,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export const listForClass = classQuery({
  args: {},
  returns: v.array(gradedSubjectListItemValidator),
  handler: async (ctx) => {
    await ctx.require("gradeScales:read");
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const rows = await ctx.db
      .query("gradedSubjects")
      .withIndex("by_classId", (q) => q.eq("classId", ctx.classDoc._id))
      .collect();
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows.map(toListItem);
  },
});

export const get = classQuery({
  args: {
    gradedSubjectId: v.id("gradedSubjects"),
  },
  returns: gradedSubjectDetailValidator,
  handler: async (ctx, args) => {
    await ctx.require("gradeScales:read");
    const subject = await requireGradedSubject(ctx, ctx.classDoc._id, args.gradedSubjectId);
    return {
      _id: subject._id,
      _creationTime: subject._creationTime,
      classId: subject.classId,
      name: subject.name,
      icon: subject.icon,
      gradeScaleId: subject.gradeScaleId,
      items: subject.items,
      createdBy: subject.createdBy,
      createdAt: subject.createdAt,
      updatedAt: subject.updatedAt,
    };
  },
});

export const create = classMutation({
  args: {
    name: v.string(),
    icon: v.optional(v.string()),
    gradeScaleId: v.id("gradeScales"),
    items: v.array(gradedSubjectItemInputValidator),
  },
  returns: v.id("gradedSubjects"),
  handler: async (ctx, args) => {
    await ctx.require("gradeScales:manage");
    const parsed = normalizeGradedSubjectInput({
      name: args.name,
      icon: args.icon,
      gradeScaleId: args.gradeScaleId,
      items: args.items as GradedSubjectItemInput[],
    });
    await requireVisibleGradeScale(ctx, ctx.classDoc._id, parsed.gradeScaleId as Id<"gradeScales">);
    await validateItemsForClass(ctx, ctx.classDoc._id, parsed.items);

    const now = Date.now();
    const gradedSubjectId = await ctx.db.insert("gradedSubjects", {
      classId: ctx.classDoc._id,
      name: parsed.name,
      ...(parsed.icon !== undefined ? { icon: parsed.icon } : {}),
      gradeScaleId: parsed.gradeScaleId as Id<"gradeScales">,
      items: parsed.items.map((item) => ({
        assignmentId: item.assignmentId as Id<"assignments">,
        sectionKey: item.sectionKey,
        weight: item.weight,
      })),
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "gradedSubject",
      resourceId: gradedSubjectId,
      summary: `Created graded subject "${parsed.name}"`,
      summaryKey: "activitySummary_createdGradedSubject",
      metadata: { name: parsed.name },
    });

    return gradedSubjectId;
  },
});

export const update = classMutation({
  args: {
    gradedSubjectId: v.id("gradedSubjects"),
    name: v.string(),
    icon: v.optional(v.string()),
    gradeScaleId: v.id("gradeScales"),
    items: v.array(gradedSubjectItemInputValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("gradeScales:manage");
    const existing = await requireGradedSubject(ctx, ctx.classDoc._id, args.gradedSubjectId);
    const parsed = normalizeGradedSubjectInput({
      name: args.name,
      icon: args.icon,
      gradeScaleId: args.gradeScaleId,
      items: args.items as GradedSubjectItemInput[],
    });
    await requireVisibleGradeScale(ctx, ctx.classDoc._id, parsed.gradeScaleId as Id<"gradeScales">);
    await validateItemsForClass(ctx, ctx.classDoc._id, parsed.items);

    await ctx.db.patch("gradedSubjects", existing._id, {
      name: parsed.name,
      icon: parsed.icon,
      gradeScaleId: parsed.gradeScaleId as Id<"gradeScales">,
      items: parsed.items.map((item) => ({
        assignmentId: item.assignmentId as Id<"assignments">,
        sectionKey: item.sectionKey,
        weight: item.weight,
      })),
      updatedAt: Date.now(),
    });

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "gradedSubject",
      resourceId: existing._id,
      summary: `Updated graded subject "${parsed.name}"`,
      summaryKey: "activitySummary_updatedGradedSubject",
      metadata: { name: parsed.name },
    });

    return null;
  },
});

export const remove = classMutation({
  args: {
    gradedSubjectId: v.id("gradedSubjects"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("gradeScales:manage");
    const existing = await requireGradedSubject(ctx, ctx.classDoc._id, args.gradedSubjectId);
    const name = existing.name;
    await ctx.db.delete("gradedSubjects", existing._id);
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "gradedSubject",
      resourceId: args.gradedSubjectId,
      summary: `Deleted graded subject "${name}"`,
      summaryKey: "activitySummary_deletedGradedSubject",
      metadata: { name },
    });
    return null;
  },
});
