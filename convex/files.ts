import { ConvexError, v } from "convex/values";

import { api, internal } from "./_generated/api.js";
import type { Doc, Id } from "./_generated/dataModel.js";
import { action } from "./_generated/server.js";
import { entitledClassQuery, entitledMutation } from "./lib/customFunctions.js";
import { clearAvatarIfReferencesFile, clearBannerIfReferencesFile } from "./lib/filesCleanup.js";
import { requireFileOwner } from "./lib/fileAccess.js";
import { ORPHAN_AGE_MS } from "./filesInternal.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import {
  detectContentType,
  getUploadPresetDefinition,
  isEnabledUploadPreset,
  isUploadPresetKey,
  validateDetectedContentType,
} from "./lib/uploadPresets.js";

const uploadPresetKeyValidator = v.union(
  v.literal("images"),
  v.literal("documents"),
  v.literal("audio"),
);

const classFilePublicValidator = v.object({
  _id: v.id("files"),
  userId: v.id("users"),
  classId: v.id("classes"),
  name: v.string(),
  contentType: v.string(),
  size: v.number(),
  preset: v.string(),
  createdAt: v.number(),
});

/** Classroom-sized library cap for a single list response. */
const CLASS_FILES_LIST_LIMIT = 200;

/**
 * Create a short-lived upload URL for Convex storage.
 *
 * Requires an active trial or subscription and is rate-limited.
 * The client should POST the raw file bytes to this URL and expect a JSON
 * response like: `{ storageId: "..." }`, then call `watchPendingUpload` and
 * `finalizeUpload`.
 */
export const generateUploadUrl = entitledMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await rateLimiter.limit(ctx, "fileUploadUrlGlobal", { key: "global", throws: true });
    await rateLimiter.limit(ctx, "fileUploadUrl", { key: ctx.userId, throws: true });
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Schedule deletion of a freshly POSTed blob if it is never finalized.
 * Call after the client receives `storageId` and before `finalizeUpload`.
 * Safe if finalize succeeds first — `deleteStorageIfOrphan` no-ops when registered.
 */
export const watchPendingUpload = entitledMutation({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "fileWatchPending", { key: ctx.userId, throws: true });
    await ctx.scheduler.runAfter(ORPHAN_AGE_MS, internal.filesInternal.deleteStorageIfOrphan, {
      storageId: args.storageId,
    });
    return null;
  },
});

/**
 * Validate (magic bytes + size + quota) and register an uploaded blob.
 * Runs as an action so it can read blob bytes for content sniffing.
 * Optional `classId` attaches the file to a class library (`files:create` required).
 */
export const finalizeUpload = action({
  args: {
    storageId: v.id("_storage"),
    name: v.string(),
    preset: uploadPresetKeyValidator,
    classId: v.optional(v.id("classes")),
  },
  returns: v.id("files"),
  handler: async (ctx, args): Promise<Id<"files">> => {
    const user = (await ctx.runQuery(api.users.currentUser, {})) as Doc<"users"> | null;
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Not authenticated",
      });
    }

    await ctx.runMutation(internal.lib.rateLimitActions.consume, {
      name: "fileFinalizeGlobal",
      key: "global",
    });
    await ctx.runMutation(internal.lib.rateLimitActions.consume, {
      name: "fileFinalize",
      key: user._id,
    });

    if (!isUploadPresetKey(args.preset) || !isEnabledUploadPreset(args.preset)) {
      await ctx.storage.delete(args.storageId);
      throw new ConvexError({
        code: "INVALID_UPLOAD",
        message: "Invalid upload preset",
      });
    }

    const blob = await ctx.storage.get(args.storageId);
    if (!blob) {
      throw new ConvexError({
        code: "UPLOAD_NOT_FOUND",
        message: "Upload not found",
      });
    }

    const size = blob.size;
    if (size > getUploadPresetDefinition(args.preset).maxSizeBytes) {
      await ctx.storage.delete(args.storageId);
      throw new ConvexError({
        code: "INVALID_UPLOAD_SIZE",
        message: "File exceeds the maximum allowed size",
      });
    }

    // Avoid blob.slice(): Convex storage blobs throw RangeError on slice+arrayBuffer
    // when size > slice length (get-convex/convex-backend#507).
    // Full buffer required for DOCX OOXML central-directory checks (presets ≤5 MiB).
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const detected = detectContentType(bytes);
    if (validateDetectedContentType(args.preset, detected) !== null || !detected) {
      await ctx.storage.delete(args.storageId);
      throw new ConvexError({
        code: "INVALID_UPLOAD_CONTENT",
        message: "File content does not match an allowed type",
      });
    }

    return await ctx.runMutation(internal.filesInternal.registerFinalizedUpload, {
      storageId: args.storageId,
      name: args.name,
      preset: args.preset,
      contentType: detected,
      size,
      classId: args.classId,
    });
  },
});

/**
 * Return file bytes for a file the caller may access (owner or class `files:read`).
 * Access is re-checked on every call via `getAccessibleFile`.
 */
export const getFileBytes = action({
  args: {
    fileId: v.id("files"),
  },
  returns: v.union(
    v.object({
      bytes: v.bytes(),
      contentType: v.string(),
      name: v.string(),
    }),
    v.null(),
  ),
  handler: async (
    ctx,
    args,
  ): Promise<{ bytes: ArrayBuffer; contentType: string; name: string } | null> => {
    const file = (await ctx.runQuery(internal.filesInternal.getAccessibleFile, {
      fileId: args.fileId,
    })) as {
      storageId: Id<"_storage">;
      viewerId: Id<"users">;
      contentType: string;
      name: string;
    } | null;
    if (!file) {
      return null;
    }

    await ctx.runMutation(internal.lib.rateLimitActions.consume, {
      name: "fileGetBytesGlobal",
      key: "global",
    });
    await ctx.runMutation(internal.lib.rateLimitActions.consume, {
      name: "fileGetBytes",
      key: file.viewerId,
    });

    const blob: Blob | null = await ctx.storage.get(file.storageId);
    if (!blob) {
      return null;
    }
    const buffer: ArrayBuffer = await blob.arrayBuffer();
    return {
      bytes: buffer,
      contentType: file.contentType,
      name: file.name,
    };
  },
});

/**
 * List metadata for files in a class library (no bytes).
 * Requires `files:read`. Classroom-sized lists are intentionally bounded.
 */
export const listClassFiles = entitledClassQuery({
  args: {},
  returns: v.array(classFilePublicValidator),
  handler: async (ctx) => {
    await ctx.require("files:read");
    const classId = ctx.classDoc._id;
    const files = await ctx.db
      .query("files")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .order("desc")
      .take(CLASS_FILES_LIST_LIMIT);
    return files.map((file) => ({
      _id: file._id,
      userId: file.userId,
      classId,
      name: file.name,
      contentType: file.contentType,
      size: file.size,
      preset: file.preset,
      createdAt: file.createdAt,
    }));
  },
});

/**
 * Rename a file the caller owns (metadata only).
 */
export const renameFile = entitledMutation({
  args: {
    fileId: v.id("files"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "fileRename", { key: ctx.userId, throws: true });
    const file = await requireFileOwner(ctx, args.fileId, ctx.userId);
    const name = args.name.trim().slice(0, 255) || "file";
    if (name === file.name) {
      return null;
    }
    await ctx.db.patch("files", args.fileId, { name });
    return null;
  },
});

/**
 * Delete a file the caller owns (row + storage blob).
 */
export const deleteFile = entitledMutation({
  args: {
    fileId: v.id("files"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "fileDelete", { key: ctx.userId, throws: true });
    const file = await requireFileOwner(ctx, args.fileId, ctx.userId);
    await clearBannerIfReferencesFile(ctx, args.fileId, file.classId);
    await clearAvatarIfReferencesFile(ctx, args.fileId, ctx.userId);
    await ctx.storage.delete(file.storageId);
    await ctx.db.delete("files", args.fileId);
    return null;
  },
});
