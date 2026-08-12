import type { Id } from "../../_generated/dataModel.js";
import type { MutationCtx } from "../../_generated/server.js";

/** Cascade-delete random assigners and runs when a class is removed. */
export async function deleteRandomAssignersForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const assigners = await ctx.db
    .query("randomAssigners")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const assigner of assigners) {
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
    const runs = await ctx.db
      .query("randomAssignerRuns")
      .withIndex("by_assignerId", (q) => q.eq("assignerId", assigner._id))
      .collect();
    for (const run of runs) {
      await ctx.db.delete("randomAssignerRuns", run._id);
    }
    await ctx.db.delete("randomAssigners", assigner._id);
  }
}
