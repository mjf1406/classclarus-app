import type { Id } from "../../_generated/dataModel.js";
import type { MutationCtx } from "../../_generated/server.js";

/** Cascade-delete all timetable data for a class. */
export async function deleteTimetableForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const slotDisables = await ctx.db
    .query("timetableSlotDisables")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const row of slotDisables) {
    await ctx.db.delete("timetableSlotDisables", row._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const lessons = await ctx.db
    .query("timetableLessons")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const lesson of lessons) {
    await ctx.db.delete("timetableLessons", lesson._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const slots = await ctx.db
    .query("timetableSlots")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const slot of slots) {
    await ctx.db.delete("timetableSlots", slot._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const subjects = await ctx.db
    .query("timetableSubjects")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const subject of subjects) {
    await ctx.db.delete("timetableSubjects", subject._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const terms = await ctx.db
    .query("timetableTerms")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const term of terms) {
    await ctx.db.delete("timetableTerms", term._id);
  }
}
