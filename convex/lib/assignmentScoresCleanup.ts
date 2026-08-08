import type { Id } from "../_generated/dataModel.js";
import type { MutationCtx } from "../_generated/server.js";

/** Delete all score rows for an assignment. */
export async function deleteScoresForAssignment(
  ctx: MutationCtx,
  assignmentId: Id<"assignments">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- assignment-scoped cleanup
  const scores = await ctx.db
    .query("assignmentScores")
    .withIndex("by_assignment", (q) => q.eq("assignmentId", assignmentId))
    .collect();
  for (const score of scores) {
    await ctx.db.delete("assignmentScores", score._id);
  }
}

/** Cascade-delete assignment scores for a class. */
export async function deleteAssignmentScoresForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const scores = await ctx.db
    .query("assignmentScores")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const score of scores) {
    await ctx.db.delete("assignmentScores", score._id);
  }
}
