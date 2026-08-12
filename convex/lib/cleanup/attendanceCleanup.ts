import type { Id } from "../../_generated/dataModel.js";
import type { MutationCtx } from "../../_generated/server.js";

/** Cascade-delete attendance sessions and records for a class. */
export async function deleteAttendanceForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const records = await ctx.db
    .query("attendanceRecords")
    .withIndex("by_classId_dateKey", (q) => q.eq("classId", classId))
    .collect();
  for (const record of records) {
    await ctx.db.delete("attendanceRecords", record._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const sessions = await ctx.db
    .query("attendanceSessions")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const session of sessions) {
    await ctx.db.delete("attendanceSessions", session._id);
  }
}
