import type { Id } from "../../_generated/dataModel.js";
import type { MutationCtx } from "../../_generated/server.js";

export async function deleteClassroomScreenForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<void> {
  const settings = await ctx.db
    .query("classroomClockSettings")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .unique();
  if (settings) await ctx.db.delete("classroomClockSettings", settings._id);

  const displaySession = await ctx.db
    .query("classroomDisplaySessions")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .unique();
  if (displaySession) await ctx.db.delete("classroomDisplaySessions", displaySession._id);

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class-scoped cleanup
  const timers = await ctx.db
    .query("classroomTimers")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const timer of timers) {
    await ctx.db.delete("classroomTimers", timer._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class-scoped cleanup
  const audioFiles = await ctx.db
    .query("classroomAudioFiles")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const audio of audioFiles) {
    await ctx.db.delete("classroomAudioFiles", audio._id);
  }
}
