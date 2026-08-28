import type { Id } from "../../_generated/dataModel.js";
import type { MutationCtx } from "../../_generated/server.js";

export const NOTIFICATION_HISTORY_PURGE_BATCH_SIZE = 50;

/**
 * Delete notification history rows tied to a class.
 * Returns true when no rows remain for the class.
 */
export async function deleteNotificationHistoryBatchForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<boolean> {
  const classIdKey = classId as string;
  const rows = await ctx.db
    .query("notificationHistory")
    .withIndex("by_classId", (q) => q.eq("classId", classIdKey))
    .take(NOTIFICATION_HISTORY_PURGE_BATCH_SIZE);

  for (const row of rows) {
    await ctx.db.delete("notificationHistory", row._id);
  }

  if (rows.length >= NOTIFICATION_HISTORY_PURGE_BATCH_SIZE) {
    return false;
  }

  const remaining = await ctx.db
    .query("notificationHistory")
    .withIndex("by_classId", (q) => q.eq("classId", classIdKey))
    .first();

  return remaining === null;
}
