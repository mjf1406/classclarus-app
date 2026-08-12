import { ConvexError } from "convex/values";

import type { Id } from "../../_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "../../_generated/server.js";
import { authz } from "../../authz.js";
import { classScope, isClassRole, pickHighestClassRole, type ClassRole } from "./authzModel.js";
import { isSelfHosted } from "../billing/selfHosted.js";

type ClassScope = ReturnType<typeof classScope>;

export async function getClassRoleForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  scope: ClassScope,
): Promise<ClassRole | null> {
  const entries = await authz.getUserRoles(ctx, userId, scope);
  return pickHighestClassRole(
    entries.map((entry: { role: string }) => entry.role).filter(isClassRole),
  );
}

/** Delete every guardian↔student link involving this user in the class. */
export async function clearLinksForUser(
  ctx: MutationCtx,
  classId: Id<"classes">,
  userId: Id<"users">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- per-guardian links are classroom-bounded
  const asGuardian = await ctx.db
    .query("guardianStudentLinks")
    .withIndex("by_class_guardian", (q) => q.eq("classId", classId).eq("guardianUserId", userId))
    .collect();
  for (const link of asGuardian) {
    await ctx.db.delete("guardianStudentLinks", link._id);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- per-student links are classroom-bounded
  const asStudent = await ctx.db
    .query("guardianStudentLinks")
    .withIndex("by_class_student", (q) => q.eq("classId", classId).eq("studentUserId", userId))
    .collect();
  for (const link of asStudent) {
    await ctx.db.delete("guardianStudentLinks", link._id);
  }
}

/** Delete all guardian↔student links for a class (e.g. on class delete). */
export async function clearLinksForClass(ctx: MutationCtx, classId: Id<"classes">): Promise<void> {
  // Walk by guardian index prefix — class-scoped, classroom-bounded.
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const links = await ctx.db
    .query("guardianStudentLinks")
    .withIndex("by_class_guardian", (q) => q.eq("classId", classId))
    .collect();
  for (const link of links) {
    await ctx.db.delete("guardianStudentLinks", link._id);
  }
}

/**
 * Student user IDs the caller may see in personal (non-staff) class views.
 * Students → self; guardians → linked students; otherwise empty.
 */
export async function resolvePersonalStudentIds(
  ctx: (QueryCtx | MutationCtx) & { userId: Id<"users"> },
  classId: Id<"classes">,
): Promise<Array<Id<"users">>> {
  const role = await getClassRoleForUser(ctx, ctx.userId, classScope(classId));
  if (role === "student") {
    return [ctx.userId];
  }
  if (role === "guardian") {
    const linked = await listLinkedStudentsForGuardian(ctx, classId, ctx.userId);
    return linked.map((student) => student.userId);
  }
  return [];
}

/** Deny unless the caller may view this student in personal attendance/points views. */
export async function assertPersonalStudentAccess(
  ctx: (QueryCtx | MutationCtx) & { userId: Id<"users"> },
  classId: Id<"classes">,
  studentUserId: Id<"users">,
): Promise<void> {
  const allowed = await resolvePersonalStudentIds(ctx, classId);
  if (!allowed.some((id) => id === studentUserId)) {
    throw new ConvexError({
      code: "CLASS_UNAVAILABLE",
      message: "Class not found or access denied",
    });
  }
}

export async function listLinkedStudentsForGuardian(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  guardianUserId: Id<"users">,
): Promise<Array<{ userId: Id<"users">; name?: string; email?: string }>> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- per-guardian links are classroom-bounded
  const links = await ctx.db
    .query("guardianStudentLinks")
    .withIndex("by_class_guardian", (q) =>
      q.eq("classId", classId).eq("guardianUserId", guardianUserId),
    )
    .collect();

  const includeEmail = isSelfHosted();
  const students: Array<{ userId: Id<"users">; name?: string; email?: string }> = [];
  for (const link of links) {
    const user = await ctx.db.get("users", link.studentUserId);
    if (!user) continue;
    students.push({
      userId: user._id,
      name: user.name,
      email: includeEmail ? user.email : undefined,
    });
  }

  students.sort((a, b) => {
    const nameA = (a.name ?? a.email ?? a.userId).toLocaleLowerCase();
    const nameB = (b.name ?? b.email ?? b.userId).toLocaleLowerCase();
    return nameA.localeCompare(nameB);
  });
  return students;
}
