import type { Id } from "../_generated/dataModel.js";
import type { MutationCtx } from "../_generated/server.js";

/** Delete a student's exclusive group membership in a class (if any). */
export async function clearGroupMembershipForStudent(
  ctx: MutationCtx,
  classId: Id<"classes">,
  studentUserId: Id<"users">,
): Promise<void> {
  const membership = await ctx.db
    .query("groupMemberships")
    .withIndex("by_class_student", (q) =>
      q.eq("classId", classId).eq("studentUserId", studentUserId),
    )
    .unique();
  if (membership) {
    await ctx.db.delete("groupMemberships", membership._id);
  }
}

/** Cascade-delete groups, teams, and memberships for a class. */
export async function deleteGroupsForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const memberships = await ctx.db
    .query("groupMemberships")
    .withIndex("by_class", (q) => q.eq("classId", classId))
    .collect();
  for (const membership of memberships) {
    await ctx.db.delete("groupMemberships", membership._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const teams = await ctx.db
    .query("teams")
    .withIndex("by_class", (q) => q.eq("classId", classId))
    .collect();
  for (const team of teams) {
    await ctx.db.delete("teams", team._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const groups = await ctx.db
    .query("groups")
    .withIndex("by_class", (q) => q.eq("classId", classId))
    .collect();
  for (const group of groups) {
    await ctx.db.delete("groups", group._id);
  }
}
