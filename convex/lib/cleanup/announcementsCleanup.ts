import type { Id } from "../../_generated/dataModel.js";
import type { MutationCtx } from "../../_generated/server.js";

/** Cascade-delete announcements for a class. */
export async function deleteAnnouncementsForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const announcements = await ctx.db
    .query("announcements")
    .withIndex("by_classId_createdAt", (q) => q.eq("classId", classId))
    .collect();
  for (const announcement of announcements) {
    await ctx.db.delete("announcements", announcement._id);
  }
}
