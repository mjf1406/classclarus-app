import type { Id } from "../_generated/dataModel.js";
import type { MutationCtx } from "../_generated/server.js";

/**
 * If `fileId` is the class banner, clear `bannerFileId`.
 * Uses the file's `classId` — banners are always same-class library files.
 */
export async function clearBannerIfReferencesFile(
  ctx: MutationCtx,
  fileId: Id<"files">,
  classId: Id<"classes"> | undefined,
): Promise<void> {
  if (classId === undefined) {
    return;
  }
  const classDoc = await ctx.db.get("classes", classId);
  if (!classDoc || classDoc.bannerFileId !== fileId) {
    return;
  }
  await ctx.db.patch("classes", classId, { bannerFileId: undefined });
}

/**
 * If `fileId` is the user's profile avatar, clear `avatarFileId` / `image`.
 */
export async function clearAvatarIfReferencesFile(
  ctx: MutationCtx,
  fileId: Id<"files">,
  userId: Id<"users">,
): Promise<void> {
  const user = await ctx.db.get("users", userId);
  if (!user || user.avatarFileId !== fileId) {
    return;
  }
  await ctx.db.patch("users", userId, {
    avatarFileId: undefined,
    image: undefined,
  });
}

/**
 * Delete all class-library files (rows + storage blobs) for a class.
 * Call before deleting the class row.
 */
export async function deleteFilesForClass(ctx: MutationCtx, classId: Id<"classes">): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class libraries are quota-bounded
  const files = await ctx.db
    .query("files")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const file of files) {
    await ctx.storage.delete(file.storageId);
    await ctx.db.delete("files", file._id);
  }
}
