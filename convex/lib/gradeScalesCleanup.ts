import type { Id } from "../_generated/dataModel.js";
import type { MutationCtx } from "../_generated/server.js";

/** Cascade-delete class-owned grade scales and hidden-default prefs (system defaults are global). */
export async function deleteGradeScalesForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const hiddenDefaults = await ctx.db
    .query("gradeScaleHiddenDefaults")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const row of hiddenDefaults) {
    await ctx.db.delete("gradeScaleHiddenDefaults", row._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const scales = await ctx.db
    .query("gradeScales")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const scale of scales) {
    await ctx.db.delete("gradeScales", scale._id);
  }
}
