import type { Id } from "../_generated/dataModel.js";
import type { MutationCtx } from "../_generated/server.js";

export async function deleteWarningEventsForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const events = await ctx.db
    .query("studentWarningEvents")
    .withIndex("by_classId_dateKey", (q) => q.eq("classId", classId))
    .collect();
  for (const event of events) {
    await ctx.db.delete("studentWarningEvents", event._id);
  }
}
