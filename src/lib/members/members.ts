import type { Id } from "../../../convex/_generated/dataModel";
import type { ClassRole, JoinCodeRole, MemberListRole } from "@/lib/permissions/classPermissions";
import {
  assignableRolesFor,
  canChangeMemberRole,
  REMOVE_PERMISSION_BY_ROLE,
} from "@/lib/permissions/classPermissions";

export type LinkedStudentPublic = {
  userId: Id<"users">;
  name?: string;
  email?: string;
};

export type ClassMemberPublic = {
  userId: Id<"users">;
  name?: string;
  image?: string;
  email?: string;
  role: Extract<ClassRole, "owner" | "teacher" | "assistant_teacher" | "student" | "guardian">;
  linkedStudents?: LinkedStudentPublic[];
};

export type ClassMemberCounts = {
  teacher: number | null;
  assistant_teacher: number | null;
  student: number | null;
  guardian: number | null;
};

export type { JoinCodeRole, MemberListRole };

export function removePermissionForMember(
  role: ClassMemberPublic["role"],
): (typeof REMOVE_PERMISSION_BY_ROLE)[ClassMemberPublic["role"]] {
  return REMOVE_PERMISSION_BY_ROLE[role];
}

/** People-page list that includes this membership role (owners appear under teachers). */
export function memberListRoleFor(role: ClassMemberPublic["role"]): MemberListRole {
  if (role === "owner" || role === "teacher") return "teacher";
  return role;
}

export { assignableRolesFor, canChangeMemberRole };

export function roleLabelKey(
  role: ClassMemberPublic["role"] | JoinCodeRole,
): "roleOwner" | "roleTeacher" | "roleAssistantTeacher" | "roleStudent" | "roleGuardian" {
  switch (role) {
    case "owner":
      return "roleOwner";
    case "teacher":
      return "roleTeacher";
    case "assistant_teacher":
      return "roleAssistantTeacher";
    case "student":
      return "roleStudent";
    case "guardian":
      return "roleGuardian";
  }
}
