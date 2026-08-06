import {
  definePermissions,
  defineRoles,
  flattenRolePermissions,
  type PermissionString,
} from "@djpanda/convex-authz";

/**
 * Single source of truth for class permissions and roles.
 * No Convex imports — safe to import from `src/` at runtime (same pattern as appConfig).
 */

export const permissions = definePermissions({
  class: { read: true, update: true, archive: true, delete: true },
  activity: { read: true },
  teachers: { read: true, invite: true, remove: true, suspend: true },
  assistantTeachers: { read: true, invite: true, remove: true, suspend: true },
  students: { read: true, add: true, remove: true, suspend: true },
  guardians: { read: true, invite: true, remove: true, suspend: true },
  invitations: { read: true, create: true, revoke: true },
  /** Class file library — create is teacher+; mutate stays ownership-based (uploader). */
  files: { read: true, create: true },
  /** App-level admin (global / unscoped). Not a class membership role. */
  admin: { syncProducts: true, viewHealth: true, manageUsers: true, viewFeedback: true },
});

export const roles = defineRoles(permissions, {
  class_member: { class: ["read"], files: ["read"] },
  student: { inherits: "class_member" },
  guardian: { inherits: "class_member" },
  assistant_teacher: {
    inherits: "class_member",
    activity: ["read"],
    teachers: ["read"],
    assistantTeachers: ["read"],
    students: ["read"],
    guardians: ["read"],
  },
  teacher: {
    inherits: "assistant_teacher",
    class: ["update", "archive"],
    students: ["add", "remove", "suspend"],
    guardians: ["invite", "remove", "suspend"],
    assistantTeachers: ["invite", "remove", "suspend"],
    invitations: ["read", "create", "revoke"],
    files: ["create"],
  },
  owner: {
    inherits: "teacher",
    class: ["delete"],
    teachers: ["invite", "remove", "suspend"],
  },
  /** Global unscoped role — assigned without a class scope. */
  app_admin: {
    admin: ["syncProducts", "viewHealth", "manageUsers", "viewFeedback"],
  },
});

export type AppPermission = PermissionString<typeof permissions>;
/** Permissions used inside class scopes (excludes app-level `admin:*`). */
export type ClassPermission = Exclude<AppPermission, `admin:${string}`>;

/** Explicit class membership roles — does NOT include `app_admin`. */
export const CLASS_ROLE_NAMES = [
  "owner",
  "teacher",
  "assistant_teacher",
  "student",
  "guardian",
  "class_member",
] as const;

export type ClassRole = (typeof CLASS_ROLE_NAMES)[number];

export const CLASS_ROLES: Array<ClassRole> = [...CLASS_ROLE_NAMES];

/** Privilege order for resolving a single display role when multiple are assigned. */
export const CLASS_ROLE_RANK: Record<ClassRole, number> = {
  owner: 60,
  teacher: 50,
  assistant_teacher: 40,
  student: 30,
  guardian: 30,
  class_member: 10,
};

export function classScope(classId: string) {
  return { type: "class", id: classId } as const;
}

export function permissionsForRole(role: ClassRole): Array<string> {
  return flattenRolePermissions(roles, role);
}

export function isClassRole(value: string): value is ClassRole {
  return (CLASS_ROLE_NAMES as ReadonlyArray<string>).includes(value);
}

export function pickHighestClassRole(roleNames: Array<string>): ClassRole | null {
  let best: ClassRole | null = null;
  let bestRank = -1;
  for (const name of roleNames) {
    if (!isClassRole(name)) continue;
    const rank = CLASS_ROLE_RANK[name];
    if (rank > bestRank) {
      best = name;
      bestRank = rank;
    }
  }
  return best;
}

/** Which permission gates suspending a member, based on the target's role. */
export const SUSPEND_PERMISSION_BY_ROLE = {
  owner: null,
  teacher: "teachers:suspend",
  assistant_teacher: "assistantTeachers:suspend",
  student: "students:suspend",
  guardian: "guardians:suspend",
  class_member: null,
} as const satisfies Record<ClassRole, ClassPermission | null>;

/** Which permission gates removing a member, based on the target's role. */
export const REMOVE_PERMISSION_BY_ROLE = {
  owner: null,
  teacher: "teachers:remove",
  assistant_teacher: "assistantTeachers:remove",
  student: "students:remove",
  guardian: "guardians:remove",
  class_member: null,
} as const satisfies Record<ClassRole, ClassPermission | null>;

/** Roles that can be assigned via join codes (not owner / class_member). */
export type JoinCodeRole = Exclude<ClassRole, "owner" | "class_member">;

/** People-page lists (owners appear on the teachers page). */
export type MemberListRole = JoinCodeRole;

/** Authz roles included when listing a people page. */
export const MEMBER_LIST_AUTHZ_ROLES = {
  teacher: ["owner", "teacher"],
  assistant_teacher: ["assistant_teacher"],
  student: ["student"],
  guardian: ["guardian"],
} as const satisfies Record<MemberListRole, ReadonlyArray<ClassRole>>;

/** Which permission gates reading a people list. */
export const MEMBER_LIST_READ_PERMISSION_BY_ROLE = {
  teacher: "teachers:read",
  assistant_teacher: "assistantTeachers:read",
  student: "students:read",
  guardian: "guardians:read",
} as const satisfies Record<MemberListRole, ClassPermission>;

export const JOIN_CODE_ROLES = [
  "teacher",
  "assistant_teacher",
  "student",
  "guardian",
] as const satisfies ReadonlyArray<JoinCodeRole>;

/** Which permission gates creating a join code for a given role. */
export const JOIN_CODE_INVITE_PERMISSION_BY_ROLE = {
  teacher: "teachers:invite",
  assistant_teacher: "assistantTeachers:invite",
  student: "students:add",
  guardian: "guardians:invite",
} as const satisfies Record<JoinCodeRole, ClassPermission>;

export function isJoinCodeRole(value: string): value is JoinCodeRole {
  return (JOIN_CODE_ROLES as ReadonlyArray<string>).includes(value);
}

/** Owners and teachers may reassign roles for members strictly below them. */
export function canManageClassRoles(actorRole: ClassRole | null | undefined): boolean {
  return actorRole === "owner" || actorRole === "teacher";
}

/** True when `otherRole` ranks strictly below `actorRole`. */
export function isStrictlyBelow(actorRole: ClassRole, otherRole: ClassRole): boolean {
  return CLASS_ROLE_RANK[otherRole] < CLASS_ROLE_RANK[actorRole];
}

/**
 * Join-code roles the actor may assign (strictly below their own rank).
 * Owners can assign teacher; teachers cannot.
 */
export function assignableRolesFor(actorRole: ClassRole): Array<JoinCodeRole> {
  if (!canManageClassRoles(actorRole)) return [];
  return JOIN_CODE_ROLES.filter((role) => isStrictlyBelow(actorRole, role));
}

/** Whether the actor may change this member's current role. */
export function canChangeMemberRole(
  actorRole: ClassRole | null | undefined,
  memberRole: ClassRole,
): boolean {
  if (!actorRole || !canManageClassRoles(actorRole)) return false;
  return isStrictlyBelow(actorRole, memberRole);
}
