import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import { normalizeOptionalPurchaseLimit, purchaseLimitValidator } from "./lib/purchaseLimit.js";
import { rateLimiter } from "./lib/rateLimiter.js";

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_ICON_LENGTH = 120;

const folderValidator = v.object({
  _id: v.id("rewardFolders"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  name: v.string(),
  description: v.optional(v.string()),
  icon: v.optional(v.string()),
  purchaseLimit: v.optional(purchaseLimitValidator),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
  itemCount: v.number(),
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

async function requireFolderInClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  folderId: Id<"rewardFolders">,
) {
  const folder = await ctx.db.get("rewardFolders", folderId);
  if (!folder || folder.classId !== classId) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Folder not found",
    });
  }
  return folder;
}

export const list = classQuery({
  args: {},
  returns: v.array(folderValidator),
  handler: async (ctx) => {
    const classId = ctx.classDoc._id;
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const folders = await ctx.db
      .query("rewardFolders")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const rewards = await ctx.db
      .query("rewards")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();

    const counts = new Map<Id<"rewardFolders">, number>();
    for (const reward of rewards) {
      if (!reward.folderId) continue;
      counts.set(reward.folderId, (counts.get(reward.folderId) ?? 0) + 1);
    }

    return folders
      .map((folder) => ({
        ...folder,
        itemCount: counts.get(folder._id) ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name) || a._creationTime - b._creationTime);
  },
});

export const create = classMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    purchaseLimit: v.optional(purchaseLimitValidator),
  },
  returns: v.id("rewardFolders"),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "rewardFolderCreate", { key: ctx.userId, throws: true });
    await ctx.require("rewards:manage");

    const classId = ctx.classDoc._id;
    const name = normalizeName(args.name);
    const description = normalizeOptionalDescription(args.description);
    const icon = normalizeOptionalIcon(args.icon);
    const purchaseLimit = normalizeOptionalPurchaseLimit(args.purchaseLimit);
    const now = Date.now();

    const folderId = await ctx.db.insert("rewardFolders", {
      classId,
      name,
      ...(description !== undefined ? { description } : {}),
      ...(icon !== undefined ? { icon } : {}),
      ...(purchaseLimit !== undefined ? { purchaseLimit } : {}),
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "rewardFolder",
      resourceId: folderId,
      summary: `Created reward folder "${name}"`,
      summaryKey: "activitySummary_createdRewardFolder",
      metadata: { name },
    });

    return folderId;
  },
});

export const update = classMutation({
  args: {
    folderId: v.id("rewardFolders"),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    purchaseLimit: v.optional(purchaseLimitValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "rewardFolderUpdate", { key: ctx.userId, throws: true });
    await ctx.require("rewards:manage");

    const classId = ctx.classDoc._id;
    await requireFolderInClass(ctx, classId, args.folderId);
    const name = normalizeName(args.name);
    const description = normalizeOptionalDescription(args.description);
    const icon = normalizeOptionalIcon(args.icon);
    const purchaseLimit = normalizeOptionalPurchaseLimit(args.purchaseLimit);

    await ctx.db.patch("rewardFolders", args.folderId, {
      name,
      description,
      icon,
      purchaseLimit,
      updatedAt: Date.now(),
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "rewardFolder",
      resourceId: args.folderId,
      summary: `Updated reward folder "${name}"`,
      summaryKey: "activitySummary_updatedRewardFolder",
      metadata: { name },
    });

    return null;
  },
});

export const remove = classMutation({
  args: {
    folderId: v.id("rewardFolders"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "rewardFolderRemove", { key: ctx.userId, throws: true });
    await ctx.require("rewards:manage");

    const classId = ctx.classDoc._id;
    const existing = await requireFolderInClass(ctx, classId, args.folderId);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- folder-scoped unfile
    const rewards = await ctx.db
      .query("rewards")
      .withIndex("by_folderId", (q) => q.eq("folderId", args.folderId))
      .collect();
    const now = Date.now();
    for (const reward of rewards) {
      await ctx.db.patch("rewards", reward._id, {
        folderId: undefined,
        updatedAt: now,
      });
    }

    await ctx.db.delete("rewardFolders", args.folderId);

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "rewardFolder",
      resourceId: args.folderId,
      summary: `Deleted reward folder "${existing.name}"`,
      summaryKey: "activitySummary_deletedRewardFolder",
      metadata: { name: existing.name },
    });

    return null;
  },
});
