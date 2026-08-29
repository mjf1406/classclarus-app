import { v } from "convex/values";

import type { Id } from "../../_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "../../_generated/server.js";

export const worksheetImagePublicFields = {
  worksheetImageFileId: v.optional(v.id("files")),
  worksheetImage: v.optional(
    v.object({
      fileId: v.id("files"),
      name: v.string(),
      contentType: v.string(),
      size: v.number(),
    }),
  ),
};

export type WorksheetImageMeta = {
  fileId: Id<"files">;
  name: string;
  contentType: string;
  size: number;
};

/**
 * Verify a class-library image file exists and belongs to `classId`.
 * Uniform deny for missing vs wrong-class — avoid existence oracle.
 */
export async function requireClassImageFile(
  ctx: MutationCtx,
  classId: Id<"classes">,
  fileId: Id<"files">,
): Promise<{ name: string }> {
  const file = await ctx.db.get("files", fileId);
  if (!file || file.classId !== classId) {
    throw new Error("File not found or access denied");
  }
  if (file.preset !== "images") {
    throw new Error("Image must be an image upload");
  }
  return { name: file.name };
}

/** Delete a class file row and its storage blob. Missing files are a no-op. */
export async function deleteClassFile(
  ctx: MutationCtx,
  fileId: Id<"files"> | undefined,
): Promise<void> {
  if (fileId === undefined) {
    return;
  }
  const file = await ctx.db.get("files", fileId);
  if (!file) {
    return;
  }
  await ctx.storage.delete(file.storageId);
  await ctx.db.delete("files", fileId);
}

/**
 * Validate the next worksheet image (when set) and delete the previous file
 * when it is being replaced or cleared.
 */
export async function resolveWorksheetImageFileId(
  ctx: MutationCtx,
  classId: Id<"classes">,
  nextFileId: Id<"files"> | undefined,
  previousFileId: Id<"files"> | undefined,
): Promise<Id<"files"> | undefined> {
  if (nextFileId !== undefined) {
    await requireClassImageFile(ctx, classId, nextFileId);
  }
  if (previousFileId !== undefined && previousFileId !== nextFileId) {
    await deleteClassFile(ctx, previousFileId);
  }
  return nextFileId;
}

/**
 * Clear `worksheetImageFileId` on any task or assignment that references `fileId`.
 */
export async function clearWorksheetImagesIfReferencesFile(
  ctx: MutationCtx,
  fileId: Id<"files">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- file-id lookup is 0–1 in practice
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_worksheetImageFileId", (q) => q.eq("worksheetImageFileId", fileId))
    .collect();
  for (const task of tasks) {
    await ctx.db.patch("tasks", task._id, { worksheetImageFileId: undefined });
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- file-id lookup is 0–1 in practice
  const assignments = await ctx.db
    .query("assignments")
    .withIndex("by_worksheetImageFileId", (q) => q.eq("worksheetImageFileId", fileId))
    .collect();
  for (const assignment of assignments) {
    await ctx.db.patch("assignments", assignment._id, { worksheetImageFileId: undefined });
  }
}

export async function loadWorksheetImageMeta(
  ctx: QueryCtx | MutationCtx,
  fileId: Id<"files"> | undefined,
): Promise<WorksheetImageMeta | undefined> {
  if (fileId === undefined) {
    return undefined;
  }
  const file = await ctx.db.get("files", fileId);
  if (!file) {
    return undefined;
  }
  return {
    fileId: file._id,
    name: file.name,
    contentType: file.contentType,
    size: file.size,
  };
}
