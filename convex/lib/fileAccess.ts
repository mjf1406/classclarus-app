import { ConvexError } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "../_generated/server.js";
import { authz } from "../authz.js";
import { classScope } from "./authzModel.js";

/**
 * Load a file the caller owns. Uniform deny when missing or not owned.
 */
export async function requireFileOwner(
  ctx: Pick<QueryCtx | MutationCtx, "db">,
  fileId: Id<"files">,
  userId: Id<"users">,
): Promise<Doc<"files">> {
  const file = await ctx.db.get("files", fileId);
  if (!file || file.userId !== userId) {
    throw new ConvexError({
      code: "UPLOAD_FORBIDDEN",
      message: "File not found or access denied",
    });
  }
  return file;
}

/**
 * Whether the caller may read file bytes / metadata.
 * Owner always; otherwise class members with `files:read` when `classId` is set.
 */
export async function canAccessFile(
  ctx: QueryCtx | MutationCtx,
  file: Doc<"files">,
  userId: Id<"users">,
): Promise<boolean> {
  if (file.userId === userId) {
    return true;
  }
  if (file.classId === undefined) {
    return false;
  }
  return await authz.can(ctx, userId, "files:read", classScope(file.classId));
}
