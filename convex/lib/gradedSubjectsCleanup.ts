import type { Id } from "../_generated/dataModel.js";
import type { MutationCtx } from "../_generated/server.js";

/** Cascade-delete graded subjects when a class is removed. */
export async function deleteGradedSubjectsForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const subjects = await ctx.db
    .query("gradedSubjects")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const subject of subjects) {
    await ctx.db.delete("gradedSubjects", subject._id);
  }
}
