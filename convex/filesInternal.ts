import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

import { APP_CONFIG } from "./appConfig.js";
import type { Id } from "./_generated/dataModel.js";
import { internalMutation, internalQuery } from "./_generated/server.js";
import { authz } from "./authz.js";
import { classScope } from "./lib/authzModel.js";
import { canAccessFile } from "./lib/fileAccess.js";
import {
  isEnabledUploadPreset,
  isUploadPresetKey,
  validateDetectedContentType,
  validateUploadAgainstPreset,
} from "./lib/uploadPresets.js";

/** Delay before a pending (unfinalized) storage blob is deleted if still unregistered. */
export const ORPHAN_AGE_MS = 60 * 60 * 1000;

const accessibleFileValidator = v.object({
  _id: v.id("files"),
  storageId: v.id("_storage"),
  userId: v.id("users"),
  /** Authenticated caller who passed the access check (for rate limiting). */
  viewerId: v.id("users"),
  classId: v.optional(v.id("classes")),
  name: v.string(),
  contentType: v.string(),
  size: v.number(),
  preset: v.string(),
  createdAt: v.number(),
});

/**
 * Load a file the authenticated caller may read (owner or class `files:read`).
 * Used by `files.getFileBytes` so access is re-checked on every fetch.
 */
export const getAccessibleFile = internalQuery({
  args: {
    fileId: v.id("files"),
  },
  returns: v.union(accessibleFileValidator, v.null()),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const file = await ctx.db.get("files", args.fileId);
    if (!file) {
      return null;
    }
    if (!(await canAccessFile(ctx, file, userId))) {
      return null;
    }
    return {
      _id: file._id,
      storageId: file.storageId,
      userId: file.userId,
      viewerId: userId,
      classId: file.classId,
      name: file.name,
      contentType: file.contentType,
      size: file.size,
      preset: file.preset,
      createdAt: file.createdAt,
    };
  },
});

/**
 * Register a finalized upload after magic-byte validation in the action layer.
 * Enforces per-user quota; deletes the blob before throwing on failure.
 * Optional `classId` requires `files:create` in that class scope.
 *
 * Invariant: the `files` table is the sole registry for app-owned blobs.
 * Anything in `_storage` without a matching `files` row is considered orphaned.
 */
export const registerFinalizedUpload = internalMutation({
  args: {
    storageId: v.id("_storage"),
    name: v.string(),
    preset: v.union(v.literal("images"), v.literal("documents"), v.literal("audio")),
    contentType: v.string(),
    size: v.number(),
    classId: v.optional(v.id("classes")),
  },
  returns: v.id("files"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Not authenticated",
      });
    }

    if (!isUploadPresetKey(args.preset) || !isEnabledUploadPreset(args.preset)) {
      await ctx.storage.delete(args.storageId);
      throw new ConvexError({
        code: "INVALID_UPLOAD",
        message: "Invalid upload preset",
      });
    }

    const existing = await ctx.db
      .query("files")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (existing) {
      if (existing.userId !== userId) {
        throw new ConvexError({
          code: "UPLOAD_FORBIDDEN",
          message: "File already registered",
        });
      }
      return existing._id;
    }

    const sizeError = validateUploadAgainstPreset(args.preset, {
      size: args.size,
      contentType: args.contentType,
    });
    if (sizeError === "invalid_size") {
      await ctx.storage.delete(args.storageId);
      throw new ConvexError({
        code: "INVALID_UPLOAD_SIZE",
        message: "File exceeds the maximum allowed size",
      });
    }

    const contentError = validateDetectedContentType(args.preset, args.contentType);
    if (contentError) {
      await ctx.storage.delete(args.storageId);
      throw new ConvexError({
        code: "INVALID_UPLOAD_CONTENT",
        message: "File content does not match an allowed type",
      });
    }

    let classId: Id<"classes"> | undefined;
    if (args.classId !== undefined) {
      const classDoc = await ctx.db.get("classes", args.classId);
      if (!classDoc) {
        await ctx.storage.delete(args.storageId);
        throw new ConvexError({
          code: "UPLOAD_FORBIDDEN",
          message: "File not found or access denied",
        });
      }
      try {
        await authz.require(ctx, userId, "files:create", classScope(args.classId));
      } catch {
        await ctx.storage.delete(args.storageId);
        throw new ConvexError({
          code: "UPLOAD_FORBIDDEN",
          message: "File not found or access denied",
        });
      }
      classId = args.classId;
    }

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- per-user uploads are quota-bounded
    const existingFiles = await ctx.db
      .query("files")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const usedBytes = existingFiles.reduce((sum, file) => sum + file.size, 0);
    if (usedBytes + args.size > APP_CONFIG.uploads.quotaBytes) {
      await ctx.storage.delete(args.storageId);
      throw new ConvexError({
        code: "QUOTA_EXCEEDED",
        message: "Storage quota exceeded",
      });
    }

    const name = args.name.trim().slice(0, 255) || "file";
    return await ctx.db.insert("files", {
      storageId: args.storageId,
      userId,
      ...(classId !== undefined ? { classId } : {}),
      name,
      contentType: args.contentType,
      size: args.size,
      preset: args.preset,
      createdAt: Date.now(),
    });
  },
});

/**
 * Delete a single storage blob if it still has no matching `files` row.
 * Scheduled by `files.watchPendingUpload` after POST; no-ops once finalized.
 */
export const deleteStorageIfOrphan = internalMutation({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const registered = await ctx.db
      .query("files")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .unique();
    if (registered) {
      return null;
    }
    await ctx.storage.delete(args.storageId);
    return null;
  },
});
