import type { Doc, Id } from "../_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "../_generated/server.js";
import { sanitizeAvatarUrl } from "./avatarUrl.js";

type UserImageSource = Pick<Doc<"users">, "image" | "avatarFileId">;

/**
 * Prefer a self-host avatar file URL; otherwise a sanitized OAuth image URL.
 * Storage URLs are generated on read so LAN/site origin changes stay valid.
 */
export async function resolveUserImageUrl(
  ctx: Pick<QueryCtx | MutationCtx, "db" | "storage">,
  user: UserImageSource,
): Promise<string | undefined> {
  if (user.avatarFileId !== undefined) {
    const file = await ctx.db.get("files", user.avatarFileId);
    if (file) {
      const url = await ctx.storage.getUrl(file.storageId);
      if (url) {
        return url;
      }
    }
  }
  return sanitizeAvatarUrl(user.image) ?? undefined;
}

/** Delete a personal avatar file row + blob. No-ops if missing or not owned. */
export async function deleteOwnedAvatarFile(
  ctx: MutationCtx,
  fileId: Id<"files">,
  userId: Id<"users">,
): Promise<void> {
  const file = await ctx.db.get("files", fileId);
  if (!file || file.userId !== userId) {
    return;
  }
  await ctx.storage.delete(file.storageId);
  await ctx.db.delete("files", fileId);
}
