import { ConvexError, v } from "convex/values";

import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import { rateLimiter } from "./lib/rateLimiter.js";

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_ICON_LENGTH = 120;

const folderValidator = v.object({
  _id: v.id("behaviorFolders"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  name: v.string(),
  description: v.optional(v.string()),
  icon: v.optional(v.string()),
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
  folderId: Id<"behaviorFolders">,
) {
  const folder = await ctx.db.get("behaviorFolders", folderId);
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
      .query("behaviorFolders")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const behaviors = await ctx.db
      .query("behaviors")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();

    const counts = new Map<Id<"behaviorFolders">, number>();
    for (const behavior of behaviors) {
      if (!behavior.folderId) continue;
      counts.set(behavior.folderId, (counts.get(behavior.folderId) ?? 0) + 1);
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
  },
  returns: v.id("behaviorFolders"),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "behaviorFolderCreate", { key: ctx.userId, throws: true });
    await ctx.require("behaviors:manage");

    const classId = ctx.classDoc._id;
    const name = normalizeName(args.name);
    const description = normalizeOptionalDescription(args.description);
    const icon = normalizeOptionalIcon(args.icon);
    const now = Date.now();

    const folderId = await ctx.db.insert("behaviorFolders", {
      classId,
      name,
      ...(description !== undefined ? { description } : {}),
      ...(icon !== undefined ? { icon } : {}),
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "behaviorFolder",
      resourceId: folderId,
      summary: `Created behavior folder "${name}"`,
      summaryKey: "activitySummary_createdBehaviorFolder",
      metadata: { name },
    });

    return folderId;
  },
});

export const update = classMutation({
  args: {
    folderId: v.id("behaviorFolders"),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "behaviorFolderUpdate", { key: ctx.userId, throws: true });
    await ctx.require("behaviors:manage");

    const classId = ctx.classDoc._id;
    await requireFolderInClass(ctx, classId, args.folderId);
    const name = normalizeName(args.name);
    const description = normalizeOptionalDescription(args.description);
    const icon = normalizeOptionalIcon(args.icon);

    await ctx.db.patch("behaviorFolders", args.folderId, {
      name,
      description,
      icon,
      updatedAt: Date.now(),
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "behaviorFolder",
      resourceId: args.folderId,
      summary: `Updated behavior folder "${name}"`,
      summaryKey: "activitySummary_updatedBehaviorFolder",
      metadata: { name },
    });

    return null;
  },
});

export const remove = classMutation({
  args: {
    folderId: v.id("behaviorFolders"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "behaviorFolderRemove", { key: ctx.userId, throws: true });
    await ctx.require("behaviors:manage");

    const classId = ctx.classDoc._id;
    const existing = await requireFolderInClass(ctx, classId, args.folderId);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- folder-scoped unfile
    const behaviors = await ctx.db
      .query("behaviors")
      .withIndex("by_folderId", (q) => q.eq("folderId", args.folderId))
      .collect();
    const now = Date.now();
    for (const behavior of behaviors) {
      await ctx.db.patch("behaviors", behavior._id, {
        folderId: undefined,
        updatedAt: now,
      });
    }

    await ctx.db.delete("behaviorFolders", args.folderId);

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "behaviorFolder",
      resourceId: args.folderId,
      summary: `Deleted behavior folder "${existing.name}"`,
      summaryKey: "activitySummary_deletedBehaviorFolder",
      metadata: { name: existing.name },
    });

    return null;
  },
});
