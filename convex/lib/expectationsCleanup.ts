import type { Id } from "../_generated/dataModel.js";
import type { MutationCtx } from "../_generated/server.js";

/** Cascade-delete expectations and values for a class. */
export async function deleteExpectationsForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const values = await ctx.db
    .query("expectationValues")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const value of values) {
    await ctx.db.delete("expectationValues", value._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const expectations = await ctx.db
    .query("expectations")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const expectation of expectations) {
    await ctx.db.delete("expectations", expectation._id);
  }
}
