import { ConvexError, v } from "convex/values";

import { authz } from "./authz.js";
import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { classScope } from "./lib/authzModel.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import { rateLimiter } from "./lib/rateLimiter.js";

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_ICON_LENGTH = 120;
const MAX_POINTS = 1_000_000;

const behaviorValidator = v.object({
  _id: v.id("behaviors"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  folderId: v.optional(v.id("behaviorFolders")),
  name: v.string(),
  description: v.optional(v.string()),
  icon: v.optional(v.string()),
  points: v.number(),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
  applicationCount: v.number(),
});

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Name is required");
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new Error(`Name must be at most ${MAX_NAME_LENGTH} characters`);
  }
  return trimmed;
}

function normalizeOptionalDescription(description: string | undefined): string | undefined {
  if (description === undefined) return undefined;
  const trimmed = description.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
  }
  return trimmed;
}

function normalizeOptionalIcon(icon: string | undefined): string | undefined {
  if (icon === undefined) return undefined;
  const trimmed = icon.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_ICON_LENGTH) {
    throw new Error(`Icon must be at most ${MAX_ICON_LENGTH} characters`);
  }
  return trimmed;
}

function normalizePoints(points: number): number {
  if (!Number.isFinite(points) || !Number.isInteger(points)) {
    throw new Error("Points must be a whole number");
  }
  if (Math.abs(points) > MAX_POINTS) {
    throw new Error(`Points must be between -${MAX_POINTS} and ${MAX_POINTS}`);
  }
  return points;
}

async function requireBehaviorInClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  behaviorId: Id<"behaviors">,
) {
  const behavior = await ctx.db.get("behaviors", behaviorId);
  if (!behavior || behavior.classId !== classId) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Behavior not found",
    });
  }
  return behavior;
}

async function requireOptionalFolderInClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  folderId: Id<"behaviorFolders"> | undefined,
): Promise<Id<"behaviorFolders"> | undefined> {
  if (folderId === undefined) return undefined;
  const folder = await ctx.db.get("behaviorFolders", folderId);
  if (!folder || folder.classId !== classId) {
    throw new Error("Folder not found in this class");
  }
  return folderId;
}

async function deleteApplicationsForBehavior(
  ctx: MutationCtx,
  behaviorId: Id<"behaviors">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- behavior-scoped cleanup
  const applications = await ctx.db
    .query("behaviorApplications")
    .withIndex("by_behaviorId", (q) => q.eq("behaviorId", behaviorId))
    .collect();
  for (const application of applications) {
    await ctx.db.delete("behaviorApplications", application._id);
  }
}

async function applyPointsRetroactively(
  ctx: MutationCtx,
  behaviorId: Id<"behaviors">,
  points: number,
): Promise<number> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- behavior-scoped rewrite
  const applications = await ctx.db
    .query("behaviorApplications")
    .withIndex("by_behaviorId", (q) => q.eq("behaviorId", behaviorId))
    .collect();
  for (const application of applications) {
    if (application.pointsApplied !== points) {
      await ctx.db.patch("behaviorApplications", application._id, {
        pointsApplied: points,
      });
    }
  }
  return applications.length;
}

export const list = classQuery({
  args: {},
  returns: v.array(behaviorValidator),
  handler: async (ctx) => {
    const classId = ctx.classDoc._id;
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const behaviors = await ctx.db
      .query("behaviors")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const applications = await ctx.db
      .query("behaviorApplications")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();

    const counts = new Map<Id<"behaviors">, number>();
    for (const application of applications) {
      counts.set(application.behaviorId, (counts.get(application.behaviorId) ?? 0) + 1);
    }

    return behaviors
      .map((behavior) => ({
        ...behavior,
        applicationCount: counts.get(behavior._id) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name) || a._creationTime - b._creationTime);
  },
});

export const create = classMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    points: v.number(),
    folderId: v.optional(v.id("behaviorFolders")),
  },
  returns: v.id("behaviors"),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "behaviorCreate", { key: ctx.userId, throws: true });
    await ctx.require("behaviors:manage");

    const classId = ctx.classDoc._id;
    const name = normalizeName(args.name);
    const description = normalizeOptionalDescription(args.description);
    const icon = normalizeOptionalIcon(args.icon);
    const points = normalizePoints(args.points);
    const folderId = await requireOptionalFolderInClass(ctx, classId, args.folderId);
    const now = Date.now();

    const behaviorId = await ctx.db.insert("behaviors", {
      classId,
      ...(folderId !== undefined ? { folderId } : {}),
      name,
      ...(description !== undefined ? { description } : {}),
      ...(icon !== undefined ? { icon } : {}),
      points,
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "behavior",
      resourceId: behaviorId,
      summary: `Created behavior "${name}"`,
      summaryKey: "activitySummary_createdBehavior",
      metadata: { name, points: String(points) },
    });

    return behaviorId;
  },
});

export const update = classMutation({
  args: {
    behaviorId: v.id("behaviors"),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    points: v.number(),
    folderId: v.optional(v.id("behaviorFolders")),
    /** When points change and applications exist: rewrite history or leave it. */
    pointsApplyMode: v.optional(v.union(v.literal("future"), v.literal("retroactive"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "behaviorUpdate", { key: ctx.userId, throws: true });
    await ctx.require("behaviors:manage");

    const classId = ctx.classDoc._id;
    const existing = await requireBehaviorInClass(ctx, classId, args.behaviorId);
    const name = normalizeName(args.name);
    const description = normalizeOptionalDescription(args.description);
    const icon = normalizeOptionalIcon(args.icon);
    const points = normalizePoints(args.points);
    const folderId = await requireOptionalFolderInClass(ctx, classId, args.folderId);
    const pointsChanged = existing.points !== points;
    const pointsApplyMode = args.pointsApplyMode ?? "future";

    await ctx.db.patch("behaviors", args.behaviorId, {
      name,
      description,
      icon,
      points,
      folderId,
      updatedAt: Date.now(),
    });

    if (pointsChanged && pointsApplyMode === "retroactive") {
      await applyPointsRetroactively(ctx, args.behaviorId, points);
    }

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "behavior",
      resourceId: args.behaviorId,
      summary: `Updated behavior "${name}"`,
      summaryKey: "activitySummary_updatedBehavior",
      metadata: {
        name,
        points: String(points),
        ...(pointsChanged ? { pointsApplyMode } : {}),
      },
    });

    return null;
  },
});

export const remove = classMutation({
  args: {
    behaviorId: v.id("behaviors"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "behaviorRemove", { key: ctx.userId, throws: true });
    await ctx.require("behaviors:manage");

    const classId = ctx.classDoc._id;
    const existing = await requireBehaviorInClass(ctx, classId, args.behaviorId);
    await deleteApplicationsForBehavior(ctx, args.behaviorId);
    await ctx.db.delete("behaviors", args.behaviorId);

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "behavior",
      resourceId: args.behaviorId,
      summary: `Deleted behavior "${existing.name}"`,
      summaryKey: "activitySummary_deletedBehavior",
      metadata: { name: existing.name },
    });

    return null;
  },
});

export const importFromClass = classMutation({
  args: {
    sourceClassId: v.id("classes"),
  },
  returns: v.object({
    folderCount: v.number(),
    behaviorCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "behaviorImport", { key: ctx.userId, throws: true });
    await ctx.require("behaviors:manage");

    const targetClassId = ctx.classDoc._id;
    if (args.sourceClassId === targetClassId) {
      throw new Error("Choose a different class to import from");
    }

    const sourceClass = await ctx.db.get("classes", args.sourceClassId);
    if (!sourceClass || sourceClass.archivedAt !== undefined) {
      throw new ConvexError({
        code: "CLASS_UNAVAILABLE",
        message: "Class not found or access denied",
      });
    }

    const canManageSource = await authz.can(
      ctx,
      ctx.userId,
      "behaviors:manage",
      classScope(args.sourceClassId),
    );
    if (!canManageSource) {
      throw new ConvexError({
        code: "CLASS_UNAVAILABLE",
        message: "Class not found or access denied",
      });
    }

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded import source
    const sourceFolders = await ctx.db
      .query("behaviorFolders")
      .withIndex("by_classId", (q) => q.eq("classId", args.sourceClassId))
      .collect();
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded import source
    const sourceBehaviors = await ctx.db
      .query("behaviors")
      .withIndex("by_classId", (q) => q.eq("classId", args.sourceClassId))
      .collect();

    const now = Date.now();
    const folderIdMap = new Map<Id<"behaviorFolders">, Id<"behaviorFolders">>();

    for (const folder of sourceFolders) {
      const newFolderId = await ctx.db.insert("behaviorFolders", {
        classId: targetClassId,
        name: folder.name,
        ...(folder.description !== undefined ? { description: folder.description } : {}),
        ...(folder.icon !== undefined ? { icon: folder.icon } : {}),
        createdBy: ctx.userId,
        createdAt: now,
        updatedAt: now,
      });
      folderIdMap.set(folder._id, newFolderId);
    }

    for (const behavior of sourceBehaviors) {
      const mappedFolderId =
        behavior.folderId !== undefined ? folderIdMap.get(behavior.folderId) : undefined;
      await ctx.db.insert("behaviors", {
        classId: targetClassId,
        ...(mappedFolderId !== undefined ? { folderId: mappedFolderId } : {}),
        name: behavior.name,
        ...(behavior.description !== undefined ? { description: behavior.description } : {}),
        ...(behavior.icon !== undefined ? { icon: behavior.icon } : {}),
        points: behavior.points,
        createdBy: ctx.userId,
        createdAt: now,
        updatedAt: now,
      });
    }

    await recordClassActivity(ctx, {
      classId: targetClassId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "behavior",
      summary: `Imported behaviors from "${sourceClass.name}"`,
      summaryKey: "activitySummary_importedBehaviors",
      metadata: {
        name: sourceClass.name,
        folderCount: String(sourceFolders.length),
        behaviorCount: String(sourceBehaviors.length),
        count: String(sourceBehaviors.length),
      },
    });

    return {
      folderCount: sourceFolders.length,
      behaviorCount: sourceBehaviors.length,
    };
  },
});
