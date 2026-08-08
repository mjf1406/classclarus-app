import { ConvexError, v } from "convex/values";

import { authz } from "./authz.js";
import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { classScope } from "./lib/authzModel.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import {
  adjustRewardPointsRewrite,
  applyRewardPointsDelta,
  ledgerQuantity,
} from "./lib/pointsRoster.js";
import { normalizeOptionalPurchaseLimit, purchaseLimitValidator } from "./lib/purchaseLimit.js";
import { rateLimiter } from "./lib/rateLimiter.js";

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_ICON_LENGTH = 120;
const MAX_POINTS = 1_000_000;

const rewardValidator = v.object({
  _id: v.id("rewards"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  folderId: v.optional(v.id("rewardFolders")),
  name: v.string(),
  description: v.optional(v.string()),
  icon: v.optional(v.string()),
  points: v.number(),
  purchaseLimit: v.optional(purchaseLimitValidator),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
  purchaseCount: v.number(),
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
    throw new Error("Cost must be a whole number");
  }
  if (points < 0 || points > MAX_POINTS) {
    throw new Error(`Cost must be between 0 and ${MAX_POINTS}`);
  }
  return points;
}

async function requireRewardInClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  rewardId: Id<"rewards">,
) {
  const reward = await ctx.db.get("rewards", rewardId);
  if (!reward || reward.classId !== classId) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Reward not found",
    });
  }
  return reward;
}

async function requireOptionalFolderInClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  folderId: Id<"rewardFolders"> | undefined,
): Promise<Id<"rewardFolders"> | undefined> {
  if (folderId === undefined) return undefined;
  const folder = await ctx.db.get("rewardFolders", folderId);
  if (!folder || folder.classId !== classId) {
    throw new Error("Folder not found in this class");
  }
  return folderId;
}

async function deletePurchasesForReward(ctx: MutationCtx, rewardId: Id<"rewards">): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- reward-scoped cleanup
  const purchases = await ctx.db
    .query("rewardPurchases")
    .withIndex("by_rewardId", (q) => q.eq("rewardId", rewardId))
    .collect();
  for (const purchase of purchases) {
    await applyRewardPointsDelta(
      ctx,
      purchase.classId,
      purchase.studentUserId,
      purchase.pointsCost,
      -1,
    );
    await ctx.db.delete("rewardPurchases", purchase._id);
  }
}

async function applyPointsRetroactively(
  ctx: MutationCtx,
  rewardId: Id<"rewards">,
  points: number,
): Promise<number> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- reward-scoped rewrite
  const purchases = await ctx.db
    .query("rewardPurchases")
    .withIndex("by_rewardId", (q) => q.eq("rewardId", rewardId))
    .collect();
  for (const purchase of purchases) {
    const nextCost = points * ledgerQuantity(purchase.quantity);
    if (purchase.pointsCost !== nextCost) {
      await adjustRewardPointsRewrite(
        ctx,
        purchase.classId,
        purchase.studentUserId,
        purchase.pointsCost,
        nextCost,
      );
      await ctx.db.patch("rewardPurchases", purchase._id, {
        pointsCost: nextCost,
      });
    }
  }
  return purchases.length;
}

export const list = classQuery({
  args: {},
  returns: v.array(rewardValidator),
  handler: async (ctx) => {
    const classId = ctx.classDoc._id;
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const rewards = await ctx.db
      .query("rewards")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const purchases = await ctx.db
      .query("rewardPurchases")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();

    const counts = new Map<Id<"rewards">, number>();
    for (const purchase of purchases) {
      counts.set(purchase.rewardId, (counts.get(purchase.rewardId) ?? 0) + 1);
    }

    return rewards
      .map((reward) => ({
        ...reward,
        purchaseCount: counts.get(reward._id) ?? 0,
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
    folderId: v.optional(v.id("rewardFolders")),
    purchaseLimit: v.optional(purchaseLimitValidator),
  },
  returns: v.id("rewards"),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "rewardCreate", { key: ctx.userId, throws: true });
    await ctx.require("rewards:manage");

    const classId = ctx.classDoc._id;
    const name = normalizeName(args.name);
    const description = normalizeOptionalDescription(args.description);
    const icon = normalizeOptionalIcon(args.icon);
    const points = normalizePoints(args.points);
    const folderId = await requireOptionalFolderInClass(ctx, classId, args.folderId);
    const purchaseLimit = normalizeOptionalPurchaseLimit(args.purchaseLimit);
    const now = Date.now();

    const rewardId = await ctx.db.insert("rewards", {
      classId,
      ...(folderId !== undefined ? { folderId } : {}),
      name,
      ...(description !== undefined ? { description } : {}),
      ...(icon !== undefined ? { icon } : {}),
      points,
      ...(purchaseLimit !== undefined ? { purchaseLimit } : {}),
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "reward",
      resourceId: rewardId,
      summary: `Created reward "${name}"`,
      summaryKey: "activitySummary_createdReward",
      metadata: { name, points: String(points) },
    });

    return rewardId;
  },
});

export const update = classMutation({
  args: {
    rewardId: v.id("rewards"),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    points: v.number(),
    folderId: v.optional(v.id("rewardFolders")),
    purchaseLimit: v.optional(purchaseLimitValidator),
    /** When cost changes and purchases exist: rewrite history or leave it. */
    pointsApplyMode: v.optional(v.union(v.literal("future"), v.literal("retroactive"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "rewardUpdate", { key: ctx.userId, throws: true });
    await ctx.require("rewards:manage");

    const classId = ctx.classDoc._id;
    const existing = await requireRewardInClass(ctx, classId, args.rewardId);
    const name = normalizeName(args.name);
    const description = normalizeOptionalDescription(args.description);
    const icon = normalizeOptionalIcon(args.icon);
    const points = normalizePoints(args.points);
    const folderId = await requireOptionalFolderInClass(ctx, classId, args.folderId);
    const purchaseLimit = normalizeOptionalPurchaseLimit(args.purchaseLimit);
    const pointsChanged = existing.points !== points;
    const pointsApplyMode = args.pointsApplyMode ?? "future";

    await ctx.db.patch("rewards", args.rewardId, {
      name,
      description,
      icon,
      points,
      folderId,
      purchaseLimit,
      updatedAt: Date.now(),
    });

    if (pointsChanged && pointsApplyMode === "retroactive") {
      await applyPointsRetroactively(ctx, args.rewardId, points);
    }

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "reward",
      resourceId: args.rewardId,
      summary: `Updated reward "${name}"`,
      summaryKey: "activitySummary_updatedReward",
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
    rewardId: v.id("rewards"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "rewardRemove", { key: ctx.userId, throws: true });
    await ctx.require("rewards:manage");

    const classId = ctx.classDoc._id;
    const existing = await requireRewardInClass(ctx, classId, args.rewardId);
    await deletePurchasesForReward(ctx, args.rewardId);
    await ctx.db.delete("rewards", args.rewardId);

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "reward",
      resourceId: args.rewardId,
      summary: `Deleted reward "${existing.name}"`,
      summaryKey: "activitySummary_deletedReward",
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
    rewardCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "rewardImport", { key: ctx.userId, throws: true });
    await ctx.require("rewards:manage");

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
      "rewards:manage",
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
      .query("rewardFolders")
      .withIndex("by_classId", (q) => q.eq("classId", args.sourceClassId))
      .collect();
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded import source
    const sourceRewards = await ctx.db
      .query("rewards")
      .withIndex("by_classId", (q) => q.eq("classId", args.sourceClassId))
      .collect();

    const now = Date.now();
    const folderIdMap = new Map<Id<"rewardFolders">, Id<"rewardFolders">>();

    for (const folder of sourceFolders) {
      const newFolderId = await ctx.db.insert("rewardFolders", {
        classId: targetClassId,
        name: folder.name,
        ...(folder.description !== undefined ? { description: folder.description } : {}),
        ...(folder.icon !== undefined ? { icon: folder.icon } : {}),
        ...(folder.purchaseLimit !== undefined ? { purchaseLimit: folder.purchaseLimit } : {}),
        createdBy: ctx.userId,
        createdAt: now,
        updatedAt: now,
      });
      folderIdMap.set(folder._id, newFolderId);
    }

    for (const reward of sourceRewards) {
      const mappedFolderId =
        reward.folderId !== undefined ? folderIdMap.get(reward.folderId) : undefined;
      await ctx.db.insert("rewards", {
        classId: targetClassId,
        ...(mappedFolderId !== undefined ? { folderId: mappedFolderId } : {}),
        name: reward.name,
        ...(reward.description !== undefined ? { description: reward.description } : {}),
        ...(reward.icon !== undefined ? { icon: reward.icon } : {}),
        points: reward.points,
        ...(reward.purchaseLimit !== undefined ? { purchaseLimit: reward.purchaseLimit } : {}),
        createdBy: ctx.userId,
        createdAt: now,
        updatedAt: now,
      });
    }

    await recordClassActivity(ctx, {
      classId: targetClassId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "reward",
      summary: `Imported rewards from "${sourceClass.name}"`,
      summaryKey: "activitySummary_importedRewards",
      metadata: {
        name: sourceClass.name,
        folderCount: String(sourceFolders.length),
        rewardCount: String(sourceRewards.length),
        count: String(sourceRewards.length),
      },
    });

    return {
      folderCount: sourceFolders.length,
      rewardCount: sourceRewards.length,
    };
  },
});
