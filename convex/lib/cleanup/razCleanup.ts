import type { Id } from "../../_generated/dataModel.js";
import type { MutationCtx } from "../../_generated/server.js";

/** Cascade-delete RAZ levels and assessments for a class. */
export async function deleteRazForClass(ctx: MutationCtx, classId: Id<"classes">): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded
  const assessments = await ctx.db
    .query("razAssessments")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const row of assessments) {
    await ctx.db.delete("razAssessments", row._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded
  const levels = await ctx.db
    .query("razStudentLevels")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const row of levels) {
    await ctx.db.delete("razStudentLevels", row._id);
  }
}
