import type { Id } from "../_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "../_generated/server.js";

export const GENDER_VALUES = [
  "male",
  "female",
  "transMale",
  "transFemale",
  "nonBinary",
  "selfDescribe",
  "preferNotToSay",
] as const;

export type GenderValue = (typeof GENDER_VALUES)[number];

export const PRONOUN_VALUES = [
  "heHim",
  "sheHer",
  "theyThem",
  "heThey",
  "sheThey",
  "useNameOnly",
  "askSelfDescribe",
  "preferNotToSay",
] as const;

export type PronounValue = (typeof PRONOUN_VALUES)[number];

function sortKeyForUser(user: { name?: string; email?: string; _id: Id<"users"> }): string {
  return (user.name ?? user.email ?? user._id).toLocaleLowerCase();
}

/** Next dense roster number for a class (max + 1, or 1). */
export async function nextRosterNumber(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
): Promise<number> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded roster
  const rows = await ctx.db
    .query("studentRosters")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  let max = 0;
  for (const row of rows) {
    if (row.rosterNumber > max) max = row.rosterNumber;
  }
  return max + 1;
}

/** Create a roster row if missing. Returns whether a row was inserted. */
export async function ensureStudentRosterRow(
  ctx: MutationCtx,
  classId: Id<"classes">,
  userId: Id<"users">,
): Promise<boolean> {
  const existing = await ctx.db
    .query("studentRosters")
    .withIndex("by_classId_userId", (q) => q.eq("classId", classId).eq("userId", userId))
    .unique();
  if (existing) return false;
  const rosterNumber = await nextRosterNumber(ctx, classId);
  await ctx.db.insert("studentRosters", {
    classId,
    userId,
    rosterNumber,
  });
  return true;
}

/** Delete a student's roster row and renumber remaining densely (1..n by previous order). */
export async function deleteStudentRosterRow(
  ctx: MutationCtx,
  classId: Id<"classes">,
  userId: Id<"users">,
): Promise<void> {
  const existing = await ctx.db
    .query("studentRosters")
    .withIndex("by_classId_userId", (q) => q.eq("classId", classId).eq("userId", userId))
    .unique();
  if (!existing) return;
  await ctx.db.delete("studentRosters", existing._id);
  await renumberStudentRosters(ctx, classId);
}

/** Rewrite roster numbers to 1..n preserving current rosterNumber order. */
export async function renumberStudentRosters(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded roster
  const rows = await ctx.db
    .query("studentRosters")
    .withIndex("by_classId_rosterNumber", (q) => q.eq("classId", classId))
    .collect();
  rows.sort((a, b) => a.rosterNumber - b.rosterNumber);
  for (let i = 0; i < rows.length; i++) {
    const next = i + 1;
    if (rows[i].rosterNumber !== next) {
      await ctx.db.patch("studentRosters", rows[i]._id, { rosterNumber: next });
    }
  }
}

/**
 * Ensure every student userId has a roster row.
 * Missing students are appended in alphabetical `users.name` order.
 */
export async function ensureStudentRostersForUsers(
  ctx: MutationCtx,
  classId: Id<"classes">,
  studentUserIds: ReadonlyArray<Id<"users">>,
): Promise<number> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded roster
  const existing = await ctx.db
    .query("studentRosters")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  const have = new Set(existing.map((row) => row.userId));
  const missingIds = studentUserIds.filter((id) => !have.has(id));
  if (missingIds.length === 0) return 0;

  const users = await Promise.all(missingIds.map((id) => ctx.db.get("users", id)));
  const sortable = missingIds
    .map((id, index) => {
      const user = users[index];
      return {
        userId: id,
        key: user ? sortKeyForUser(user) : id,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  let next = await nextRosterNumber(ctx, classId);
  for (const entry of sortable) {
    await ctx.db.insert("studentRosters", {
      classId,
      userId: entry.userId,
      rosterNumber: next,
    });
    next += 1;
  }
  return sortable.length;
}

/** Cascade-delete all roster rows for a class. */
export async function deleteStudentRostersForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup
  const rows = await ctx.db
    .query("studentRosters")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const row of rows) {
    await ctx.db.delete("studentRosters", row._id);
  }
}

/** Delete all roster rows for a user (account deletion). */
export async function deleteStudentRostersForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- per-user roster rows across classes
  const rows = await ctx.db
    .query("studentRosters")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  const classIds = new Set(rows.map((row) => row.classId));
  for (const row of rows) {
    await ctx.db.delete("studentRosters", row._id);
  }
  for (const classId of classIds) {
    await renumberStudentRosters(ctx, classId);
  }
}

/** Cascade-delete class user settings for a class. */
export async function deleteClassUserSettingsForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup
  const rows = await ctx.db
    .query("classUserSettings")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const row of rows) {
    await ctx.db.delete("classUserSettings", row._id);
  }
}

/** Delete class user settings for a user (account deletion). */
export async function deleteClassUserSettingsForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- per-user settings across classes
  const rows = await ctx.db
    .query("classUserSettings")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  for (const row of rows) {
    await ctx.db.delete("classUserSettings", row._id);
  }
}
