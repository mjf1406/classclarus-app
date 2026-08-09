import { matchesPermissionPattern } from "@djpanda/convex-authz";

export type {
  ClassPermission,
  ClassRole,
  JoinCodeRole,
  MemberListRole,
  PermissionOverrideEffect,
  PermissionOverrideTargetRole,
} from "../../../convex/lib/authzModel";
export {
  CLASS_ROLE_RANK,
  CLASS_ROLES,
  GRANTABLE_CLASS_PERMISSIONS,
  JOIN_CODE_INVITE_PERMISSION_BY_ROLE,
  JOIN_CODE_ROLES,
  MEMBER_LIST_AUTHZ_ROLES,
  MEMBER_LIST_READ_PERMISSION_BY_ROLE,
  PERMISSION_OVERRIDE_TARGET_ROLES,
  REMOVE_PERMISSION_BY_ROLE,
  assignableRolesFor,
  canChangeMemberRole,
  canManageClassRoles,
  classScope,
  effectivePermissionEnabled,
  grantablePermissionGroups,
  isClassRole,
  isGrantableClassPermission,
  isJoinCodeRole,
  isPermissionOverrideTargetRole,
  isStrictlyBelow,
  permissionsForRole,
  pickHighestClassRole,
  SUSPEND_PERMISSION_BY_ROLE,
} from "../../../convex/lib/authzModel";

import {
  permissionsForRole,
  type ClassPermission,
  type ClassRole,
} from "../../../convex/lib/authzModel";

export function createPermissionChecker(granted: ReadonlyArray<string>) {
  return function can(permission: ClassPermission | string): boolean {
    if (granted.length === 0) return false;
    // Exact allow, or a stored allow pattern that matches the requested permission.
    if (granted.includes(permission)) return true;
    return granted.some((pattern) => matchesPermissionPattern(permission, pattern));
  };
}

export function permissionsFromRole(role: ClassRole | null | undefined): Array<string> {
  if (!role) return [];
  return permissionsForRole(role);
}
