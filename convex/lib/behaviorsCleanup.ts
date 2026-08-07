import type { Id } from "../_generated/dataModel.js";
import type { MutationCtx } from "../_generated/server.js";

/** Cascade-delete behavior applications, behaviors, and folders for a class. */
export async function deleteBehaviorsForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const applications = await ctx.db
    .query("behaviorApplications")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const application of applications) {
    await ctx.db.delete("behaviorApplications", application._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const behaviors = await ctx.db
    .query("behaviors")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const behavior of behaviors) {
    await ctx.db.delete("behaviors", behavior._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const folders = await ctx.db
    .query("behaviorFolders")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const folder of folders) {
    await ctx.db.delete("behaviorFolders", folder._id);
  }
}
