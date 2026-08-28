import type { Id } from "../../_generated/dataModel.js";
import type { MutationCtx } from "../../_generated/server.js";

export const FILES_PURGE_BATCH_SIZE = 10;

/**
 * Delete class-library files in batches (rows + storage blobs).
 * Returns true when no files remain for the class.
 */
export async function deleteFilesBatchForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<boolean> {
  const files = await ctx.db
    .query("files")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .take(FILES_PURGE_BATCH_SIZE);

  for (const file of files) {
    await ctx.storage.delete(file.storageId);
    await ctx.db.delete("files", file._id);
  }

  if (files.length >= FILES_PURGE_BATCH_SIZE) {
    return false;
  }

  const remaining = await ctx.db
    .query("files")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .first();

  return remaining === null;
}
