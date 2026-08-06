import { v } from "convex/values";

import { authz } from "./authz.js";
import { APP_CONFIG } from "./appConfig.js";
import { components } from "./_generated/api.js";
import type { Doc, Id } from "./_generated/dataModel.js";
import type { MutationCtx } from "./_generated/server.js";
import {
  CLASS_ROLES,
  classScope,
  isClassRole,
  pickHighestClassRole,
  type ClassRole,
} from "./lib/authzModel.js";
import {
  authedQuery,
  classMutation,
  classQuery,
  entitledClassMutation,
  entitledMutation,
  entitledQuery,
} from "./lib/customFunctions.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import { clearLinksForClass } from "./lib/guardianLinks.js";
import { deleteFilesForClass } from "./lib/filesCleanup.js";
import { deleteJoinCodesForClass } from "./lib/joinCodesCleanup.js";
import { resolveUserImageUrl } from "./lib/userImage.js";

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_ICON_LENGTH = 32;

const classRoleValidator = v.union(
  v.literal("owner"),
  v.literal("teacher"),
  v.literal("assistant_teacher"),
  v.literal("student"),
  v.literal("guardian"),
  v.literal("class_member"),
);

const classValidator = v.object({
  _id: v.id("classes"),
  _creationTime: v.number(),
  ownerId: v.id("users"),
  name: v.string(),
  year: v.number(),
  description: v.optional(v.string()),
  icon: v.optional(v.string()),
  bannerFileId: v.optional(v.id("files")),
  updatedAt: v.number(),
  archivedAt: v.optional(v.number()),
});

const classWithRoleValidator = classValidator.extend({
  role: classRoleValidator,
});

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Class name is required");
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new Error(`Class name must be at most ${MAX_NAME_LENGTH} characters`);
  }
  return trimmed;
}

function normalizeYear(year: number): number {
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    throw new Error(`Year must be an integer between ${MIN_YEAR} and ${MAX_YEAR}`);
  }
  return year;
}

function normalizeDescription(description: string | undefined): string | undefined {
  if (description === undefined) {
    return undefined;
  }
  const trimmed = description.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
  }
  return trimmed;
}

function normalizeIcon(icon: string | undefined): string | undefined {
  if (icon === undefined) {
    return undefined;
  }
  const trimmed = icon.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length > MAX_ICON_LENGTH) {
    throw new Error(`Icon must be at most ${MAX_ICON_LENGTH} characters`);
  }
  const isFontAwesome = /^(fas|far):[a-z0-9-]+$/i.test(trimmed);
  // Allow a single grapheme emoji (or short emoji sequence) as an alternative to FA ids.
  const isEmoji = !trimmed.includes(":") && /\p{Extended_Pictographic}/u.test(trimmed);
  if (!isFontAwesome && !isEmoji) {
    throw new Error("Icon must be a Font Awesome id or emoji");
  }
  return trimmed;
}

function deleteConfirmationPhrase(name: string): string {
  return `delete ${name}`;
}

async function revokeAllClassMembership(ctx: MutationCtx, classId: Id<"classes">): Promise<void> {
  const scope = classScope(classId);
  const userIds = new Set<string>();
  for (const role of CLASS_ROLES) {
    const users = await ctx.runQuery(components.authz.queries.getUsersWithRole, {
      tenantId: APP_CONFIG.authzTenantId,
      role,
      scope,
    });
    for (const user of users) {
      userIds.add(user.userId);
    }
  }
  for (const userId of userIds) {
    await authz.offboardUser(ctx, userId, {
      scope,
      removeOverrides: true,
      removeRelationships: true,
      removeAttributes: false,
    });
  }
}

export const listMine = entitledQuery({
  args: {},
  returns: v.array(classWithRoleValidator),
  handler: async (ctx) => {
    const roleEntries = await authz.getUserRoles(ctx, ctx.userId);
    const rolesByClassId = new Map<string, Array<string>>();

    for (const entry of roleEntries) {
      let classId: string | null = null;
      if (entry.scope?.type === "class") {
        classId = entry.scope.id;
      } else if (typeof entry.scopeKey === "string" && entry.scopeKey.startsWith("class:")) {
        classId = entry.scopeKey.slice("class:".length);
      }
      if (!classId) continue;
      const existing = rolesByClassId.get(classId) ?? [];
      existing.push(entry.role);
      rolesByClassId.set(classId, existing);
    }

    const results: Array<Doc<"classes"> & { role: ClassRole }> = [];

    for (const [classId, roleNames] of rolesByClassId) {
      const scope = classScope(classId);
      const canRead = await authz.can(ctx, ctx.userId, "class:read", scope);
      if (!canRead) continue;

      const role = pickHighestClassRole(roleNames.filter(isClassRole));
      if (!role) continue;

      const classDoc = await ctx.db.get("classes", classId as Id<"classes">);
      if (!classDoc) continue;

      results.push({ ...classDoc, role });
    }

    return results;
  },
});

/**
 * Classes owned by the current user.
 * Intentionally ungated by entitlement so expired owners can still transfer or
 * delete classes from /account (exit path for the owns_classes deletion blocker).
 */
export const listOwned = authedQuery({
  args: {},
  returns: v.array(classValidator),
  handler: async (ctx) => {
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- owned classes per user are bounded
    const owned = await ctx.db
      .query("classes")
      .withIndex("by_owner", (q) => q.eq("ownerId", ctx.userId))
      .collect();
    return owned;
  },
});

export const get = entitledQuery({
  args: { classId: v.id("classes") },
  returns: v.union(classValidator, v.null()),
  handler: async (ctx, args) => {
    const classDoc = await ctx.db.get("classes", args.classId);
    if (!classDoc) {
      return null;
    }
    const canRead = await authz.can(ctx, ctx.userId, "class:read", classScope(args.classId));
    if (!canRead) {
      return null;
    }
    return classDoc;
  },
});

export const create = entitledMutation({
  args: {
    name: v.string(),
    year: v.number(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  returns: classValidator,
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "classCreateGlobal", { key: "global", throws: true });
    await rateLimiter.limit(ctx, "classCreate", { key: ctx.userId, throws: true });
    const now = Date.now();
    const classId = await ctx.db.insert("classes", {
      ownerId: ctx.userId,
      name: normalizeName(args.name),
      year: normalizeYear(args.year),
      description: normalizeDescription(args.description),
      icon: normalizeIcon(args.icon),
      updatedAt: now,
    });
    await authz.assignRole(ctx, ctx.userId, "owner", classScope(classId));
    const created = await ctx.db.get("classes", classId);
    if (!created) {
      throw new Error("Failed to create class");
    }
    return created;
  },
});

export const update = entitledClassMutation({
  args: {
    name: v.string(),
    year: v.number(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  returns: classValidator,
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "classUpdate", { key: ctx.userId, throws: true });
    await ctx.require("class:update");
    await ctx.db.patch("classes", ctx.classDoc._id, {
      name: normalizeName(args.name),
      year: normalizeYear(args.year),
      description: normalizeDescription(args.description),
      icon: normalizeIcon(args.icon),
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get("classes", ctx.classDoc._id);
    if (!updated) {
      throw new Error("Failed to update class");
    }
    return updated;
  },
});

export const setArchived = entitledClassMutation({
  args: {
    archived: v.boolean(),
  },
  returns: classValidator,
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "classArchive", { key: ctx.userId, throws: true });
    await ctx.require("class:archive");
    await ctx.db.patch("classes", ctx.classDoc._id, {
      archivedAt: args.archived ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get("classes", ctx.classDoc._id);
    if (!updated) {
      throw new Error("Failed to update class archive state");
    }
    return updated;
  },
});

export const setBanner = entitledClassMutation({
  args: {
    fileId: v.id("files"),
  },
  returns: classValidator,
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "classUpdate", { key: ctx.userId, throws: true });
    await ctx.require("class:update");

    const file = await ctx.db.get("files", args.fileId);
    // Uniform deny for missing vs wrong-class — avoid existence oracle.
    if (!file || file.classId !== ctx.classDoc._id) {
      throw new Error("File not found or access denied");
    }
    if (file.preset !== "images") {
      throw new Error("Banner must be an image");
    }

    await ctx.db.patch("classes", ctx.classDoc._id, {
      bannerFileId: args.fileId,
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get("classes", ctx.classDoc._id);
    if (!updated) {
      throw new Error("Failed to set class banner");
    }
    return updated;
  },
});

export const clearBanner = entitledClassMutation({
  args: {},
  returns: classValidator,
  handler: async (ctx) => {
    await rateLimiter.limit(ctx, "classUpdate", { key: ctx.userId, throws: true });
    await ctx.require("class:update");
    await ctx.db.patch("classes", ctx.classDoc._id, {
      bannerFileId: undefined,
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get("classes", ctx.classDoc._id);
    if (!updated) {
      throw new Error("Failed to clear class banner");
    }
    return updated;
  },
});

export const remove = classMutation({
  args: {
    confirmation: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "classDelete", { key: ctx.userId, throws: true });
    await ctx.require("class:delete");
    const expected = deleteConfirmationPhrase(ctx.classDoc.name);
    if (args.confirmation !== expected) {
      throw new Error(`Type "${expected}" to confirm deletion`);
    }
    await revokeAllClassMembership(ctx, ctx.classDoc._id);
    await deleteJoinCodesForClass(ctx, ctx.classDoc._id);
    await clearLinksForClass(ctx, ctx.classDoc._id);
    await deleteFilesForClass(ctx, ctx.classDoc._id);
    await ctx.db.delete("classes", ctx.classDoc._id);
    return null;
  },
});

const eligibleOwnerValidator = v.object({
  userId: v.id("users"),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  image: v.optional(v.string()),
  role: v.union(v.literal("teacher"), v.literal("assistant_teacher")),
});

/**
 * Teachers and assistant teachers who can receive ownership (non-suspended).
 */
export const eligibleOwners = classQuery({
  args: {},
  returns: v.array(eligibleOwnerValidator),
  handler: async (ctx) => {
    await ctx.require("class:delete");

    const byUserId = new Map<string, "teacher" | "assistant_teacher">();
    for (const role of ["teacher", "assistant_teacher"] as const) {
      const users = await ctx.runQuery(components.authz.queries.getUsersWithRole, {
        tenantId: APP_CONFIG.authzTenantId,
        role,
        scope: ctx.scope,
      });
      for (const entry of users) {
        if (entry.userId === ctx.userId) continue;
        const existing = byUserId.get(entry.userId);
        if (!existing || role === "teacher") {
          byUserId.set(entry.userId, role);
        }
      }
    }

    const results: Array<{
      userId: Id<"users">;
      name?: string;
      email?: string;
      image?: string;
      role: "teacher" | "assistant_teacher";
    }> = [];

    for (const [userId, role] of byUserId) {
      const canAct = await authz.can(ctx, userId, "class:read", ctx.scope);
      if (!canAct) continue;
      const user = await ctx.db.get("users", userId as Id<"users">);
      if (!user) continue;
      results.push({
        userId: user._id,
        name: user.name,
        email: user.email,
        image: await resolveUserImageUrl(ctx, user),
        role,
      });
    }

    results.sort((a, b) => {
      const nameA = (a.name ?? a.email ?? a.userId).toLocaleLowerCase();
      const nameB = (b.name ?? b.email ?? b.userId).toLocaleLowerCase();
      return nameA.localeCompare(nameB);
    });

    return results;
  },
});

/**
 * Transfer class ownership to a teacher or assistant_teacher.
 * Unentitled exit path so expired-trial owners can still satisfy GDPR deletion.
 */
export const transferOwnership = classMutation({
  args: {
    toUserId: v.id("users"),
  },
  returns: classValidator,
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "classTransferOwnership", { key: ctx.userId, throws: true });
    await ctx.require("class:delete");

    if (args.toUserId === ctx.userId) {
      throw new Error("You already own this class");
    }

    if (ctx.classDoc.ownerId !== ctx.userId) {
      throw new Error("Only the current owner can transfer ownership");
    }

    const targetRoles = await authz.getUserRoles(ctx, args.toUserId, ctx.scope);
    const role = pickHighestClassRole(
      targetRoles.map((entry: { role: string }) => entry.role).filter(isClassRole),
    );
    if (role !== "teacher" && role !== "assistant_teacher") {
      throw new Error("Recipient must be a teacher or assistant teacher in this class");
    }

    const canAct = await authz.can(ctx, args.toUserId, "class:read", ctx.scope);
    if (!canAct) {
      throw new Error("Recipient is suspended and cannot receive ownership");
    }

    await authz.assignRole(ctx, args.toUserId, "owner", ctx.scope);
    // Drop the recipient's previous membership role so they are owner only.
    await authz.revokeRole(ctx, args.toUserId, role, ctx.scope);
    await authz.revokeRole(ctx, ctx.userId, "owner", ctx.scope);
    // Outgoing owner is demoted to teacher (not removed from the class).
    await authz.assignRole(ctx, ctx.userId, "teacher", ctx.scope);

    await ctx.db.patch("classes", ctx.classDoc._id, {
      ownerId: args.toUserId,
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get("classes", ctx.classDoc._id);
    if (!updated) {
      throw new Error("Failed to transfer ownership");
    }
    return updated;
  },
});
