import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api.js";
import type { Doc, Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { internalMutation } from "./_generated/server.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { authedMutation, classMutation, classQuery } from "./lib/customFunctions.js";
import {
  GRADE_SCALE_SYSTEM_KEYS,
  SYSTEM_GRADE_SCALE_SEEDS,
  type GradeScaleSystemKey,
} from "./lib/gradeScales/defaults.js";
import {
  normalizeGradeScaleLevels,
  normalizeGradeScaleName,
  type GradeScaleLevelInput,
} from "./lib/gradeScales/normalize.js";

const gradeScaleSystemKeyValidator = v.union(
  v.literal("highRange"),
  v.literal("perfectScore"),
  v.literal("standard"),
  v.literal("letterGrades"),
);

const gradeScaleLevelInputValidator = v.object({
  key: v.optional(v.string()),
  label: v.string(),
  minPercent: v.number(),
  maxPercent: v.number(),
});

const gradeScaleLevelValidator = v.object({
  key: v.string(),
  label: v.string(),
  minPercent: v.number(),
  maxPercent: v.number(),
});

const gradeScaleListItemValidator = v.object({
  _id: v.id("gradeScales"),
  _creationTime: v.number(),
  isSystem: v.boolean(),
  systemKey: v.optional(gradeScaleSystemKeyValidator),
  name: v.optional(v.string()),
  nameKey: v.optional(v.string()),
  levels: v.array(gradeScaleLevelValidator),
  createdBy: v.optional(v.id("users")),
  createdAt: v.number(),
  updatedAt: v.number(),
  isHidden: v.boolean(),
});

function isSystemScale(doc: Doc<"gradeScales">): boolean {
  return doc.systemKey !== undefined && doc.classId === undefined;
}

function toListItem(doc: Doc<"gradeScales">, isHidden: boolean) {
  return {
    _id: doc._id,
    _creationTime: doc._creationTime,
    isSystem: isSystemScale(doc),
    systemKey: doc.systemKey,
    name: doc.name,
    nameKey: doc.nameKey,
    levels: doc.levels,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    isHidden,
  };
}

async function loadHiddenSystemKeys(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
): Promise<Set<GradeScaleSystemKey>> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- bounded to 3 system keys per class
  const rows = await ctx.db
    .query("gradeScaleHiddenDefaults")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  return new Set(rows.map((row) => row.systemKey));
}

async function loadSystemScales(ctx: QueryCtx | MutationCtx) {
  const rows: Doc<"gradeScales">[] = [];
  for (const systemKey of GRADE_SCALE_SYSTEM_KEYS) {
    const row = await ctx.db
      .query("gradeScales")
      .withIndex("by_systemKey", (q) => q.eq("systemKey", systemKey))
      .unique();
    if (row) rows.push(row);
  }
  return rows;
}

async function requireClassScale(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  gradeScaleId: Id<"gradeScales">,
): Promise<Doc<"gradeScales">> {
  const scale = await ctx.db.get("gradeScales", gradeScaleId);
  if (!scale || scale.classId !== classId || isSystemScale(scale)) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Grade scale not found",
    });
  }
  return scale;
}

async function requireAnyScale(
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
  if (isSystemScale(scale)) return scale;
  if (scale.classId !== classId) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Grade scale not found",
    });
  }
  return scale;
}

export const ensureSystemDefaultsInternal = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    for (const seed of SYSTEM_GRADE_SCALE_SEEDS) {
      const existing = await ctx.db
        .query("gradeScales")
        .withIndex("by_systemKey", (q) => q.eq("systemKey", seed.systemKey))
        .unique();
      if (existing) continue;
      await ctx.db.insert("gradeScales", {
        systemKey: seed.systemKey,
        nameKey: seed.nameKey,
        levels: seed.levels,
        createdAt: now,
        updatedAt: now,
      });
    }
    return null;
  },
});

export const ensureSystemDefaults = authedMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.runMutation(internal.gradeScales.ensureSystemDefaultsInternal, {});
    return null;
  },
});

export const listForClass = classQuery({
  args: {},
  returns: v.array(gradeScaleListItemValidator),
  handler: async (ctx) => {
    await ctx.require("gradeScales:read");
    const [systemRows, classRows, hiddenSystemKeys] = await Promise.all([
      loadSystemScales(ctx),
      // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
      ctx.db
        .query("gradeScales")
        .withIndex("by_classId", (q) => q.eq("classId", ctx.classDoc._id))
        .collect(),
      loadHiddenSystemKeys(ctx, ctx.classDoc._id),
    ]);

    const systemOrder = new Map<GradeScaleSystemKey, number>(
      GRADE_SCALE_SYSTEM_KEYS.map((key, index) => [key, index]),
    );
    systemRows.sort(
      (a, b) =>
        (systemOrder.get(a.systemKey ?? "standard") ?? 99) -
        (systemOrder.get(b.systemKey ?? "standard") ?? 99),
    );
    classRows.sort((a, b) => a.name?.localeCompare(b.name ?? "") ?? 0);

    return [
      ...systemRows.map((row) =>
        toListItem(row, hiddenSystemKeys.has(row.systemKey ?? "standard")),
      ),
      ...classRows.map((row) => toListItem(row, false)),
    ];
  },
});

export const create = classMutation({
  args: {
    name: v.string(),
    levels: v.array(gradeScaleLevelInputValidator),
  },
  returns: v.id("gradeScales"),
  handler: async (ctx, args) => {
    await ctx.require("gradeScales:manage");
    const name = normalizeGradeScaleName(args.name);
    const levels = normalizeGradeScaleLevels(args.levels as GradeScaleLevelInput[]);
    const now = Date.now();
    const gradeScaleId = await ctx.db.insert("gradeScales", {
      classId: ctx.classDoc._id,
      name,
      levels,
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "gradeScale",
      resourceId: gradeScaleId,
      summary: `Created grade scale "${name}"`,
      summaryKey: "activitySummary_createdGradeScale",
      metadata: { name },
    });
    return gradeScaleId;
  },
});

export const update = classMutation({
  args: {
    gradeScaleId: v.id("gradeScales"),
    name: v.string(),
    levels: v.array(gradeScaleLevelInputValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("gradeScales:manage");
    const existing = await requireClassScale(ctx, ctx.classDoc._id, args.gradeScaleId);
    const name = normalizeGradeScaleName(args.name);
    const levels = normalizeGradeScaleLevels(args.levels as GradeScaleLevelInput[]);
    await ctx.db.patch("gradeScales", existing._id, {
      name,
      levels,
      updatedAt: Date.now(),
    });
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "gradeScale",
      resourceId: existing._id,
      summary: `Updated grade scale "${name}"`,
      summaryKey: "activitySummary_updatedGradeScale",
      metadata: { name },
    });
    return null;
  },
});

export const remove = classMutation({
  args: {
    gradeScaleId: v.id("gradeScales"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("gradeScales:manage");
    const existing = await requireClassScale(ctx, ctx.classDoc._id, args.gradeScaleId);
    const name = existing.name ?? "Grade scale";
    await ctx.db.delete("gradeScales", existing._id);
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "gradeScale",
      resourceId: args.gradeScaleId,
      summary: `Deleted grade scale "${name}"`,
      summaryKey: "activitySummary_deletedGradeScale",
      metadata: { name },
    });
    return null;
  },
});

export const duplicate = classMutation({
  args: {
    gradeScaleId: v.id("gradeScales"),
    name: v.string(),
  },
  returns: v.id("gradeScales"),
  handler: async (ctx, args) => {
    await ctx.require("gradeScales:manage");
    const source = await requireAnyScale(ctx, ctx.classDoc._id, args.gradeScaleId);
    const name = normalizeGradeScaleName(args.name);
    const now = Date.now();
    const gradeScaleId = await ctx.db.insert("gradeScales", {
      classId: ctx.classDoc._id,
      name,
      levels: source.levels.map((level) => ({ ...level })),
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "gradeScale",
      resourceId: gradeScaleId,
      summary: `Duplicated grade scale as "${name}"`,
      summaryKey: "activitySummary_duplicatedGradeScale",
      metadata: { name },
    });
    return gradeScaleId;
  },
});

export const setSystemDefaultHidden = classMutation({
  args: {
    systemKey: gradeScaleSystemKeyValidator,
    hidden: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("gradeScales:manage");
    const classId = ctx.classDoc._id;
    const systemScale = await ctx.db
      .query("gradeScales")
      .withIndex("by_systemKey", (q) => q.eq("systemKey", args.systemKey))
      .unique();
    if (!systemScale || !isSystemScale(systemScale)) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Default grade scale not found",
      });
    }

    const existing = await ctx.db
      .query("gradeScaleHiddenDefaults")
      .withIndex("by_classId_systemKey", (q) =>
        q.eq("classId", classId).eq("systemKey", args.systemKey),
      )
      .unique();

    const nameKey =
      SYSTEM_GRADE_SCALE_SEEDS.find((seed) => seed.systemKey === args.systemKey)?.nameKey ??
      args.systemKey;

    if (args.hidden) {
      if (existing) return null;
      await ctx.db.insert("gradeScaleHiddenDefaults", {
        classId,
        systemKey: args.systemKey,
        hiddenBy: ctx.userId,
        hiddenAt: Date.now(),
      });
      await recordClassActivity(ctx, {
        classId,
        actorUserId: ctx.userId,
        action: "update",
        resourceType: "gradeScale",
        resourceId: systemScale._id,
        summary: `Hidden default grade scale "${nameKey}"`,
        summaryKey: "activitySummary_hiddenGradeScaleDefault",
        metadata: { nameKey, systemKey: args.systemKey },
      });
      return null;
    }

    if (existing) {
      await ctx.db.delete("gradeScaleHiddenDefaults", existing._id);
      await recordClassActivity(ctx, {
        classId,
        actorUserId: ctx.userId,
        action: "update",
        resourceType: "gradeScale",
        resourceId: systemScale._id,
        summary: `Restored default grade scale "${nameKey}"`,
        summaryKey: "activitySummary_shownGradeScaleDefault",
        metadata: { nameKey, systemKey: args.systemKey },
      });
    }
    return null;
  },
});
