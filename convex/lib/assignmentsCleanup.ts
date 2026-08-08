import type { Id } from "../_generated/dataModel.js";
import type { MutationCtx } from "../_generated/server.js";

/** Cascade-delete assignments and student links for a class. Linked tasks are left intact. */
export async function deleteAssignmentsForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const links = await ctx.db
    .query("assignmentStudentLinks")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const link of links) {
    await ctx.db.delete("assignmentStudentLinks", link._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const assignments = await ctx.db
    .query("assignments")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const assignment of assignments) {
    await ctx.db.delete("assignments", assignment._id);
  }
}
