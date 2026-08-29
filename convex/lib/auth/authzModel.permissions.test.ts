import { describe, expect, test } from "vite-plus/test";

import {
  GRANTABLE_CLASS_PERMISSIONS,
  effectivePermissionEnabled,
  grantablePermissionGroups,
  isGrantableClassPermission,
  isPermissionOverrideTargetRole,
  permissionsForRole,
} from "./authzModel";

describe("grantable class permissions", () => {
  test("excludes owner-only and admin permissions", () => {
    expect(isGrantableClassPermission("permissions:manage")).toBe(false);
    expect(isGrantableClassPermission("class:delete")).toBe(false);
    expect(isGrantableClassPermission("admin:manageUsers")).toBe(false);
    expect(GRANTABLE_CLASS_PERMISSIONS).not.toContain("permissions:manage");
    expect(GRANTABLE_CLASS_PERMISSIONS).not.toContain("class:delete");
  });

  test("includes common staff permissions from the owner catalog", () => {
    expect(isGrantableClassPermission("tasks:manage")).toBe(true);
    expect(isGrantableClassPermission("students:read")).toBe(true);
    expect(GRANTABLE_CLASS_PERMISSIONS).toContain("tasks:manage");
    expect(GRANTABLE_CLASS_PERMISSIONS.every((permission) => permission.includes(":"))).toBe(true);
  });

  test("groups permissions by resource", () => {
    const groups = grantablePermissionGroups();
    const classGroup = groups.find((group) => group.resource === "class");
    expect(classGroup?.permissions).toEqual(
      expect.arrayContaining(["class:read", "class:update", "class:archive"]),
    );
    expect(classGroup?.permissions).not.toContain("class:delete");
  });

  test("owner role includes permissions:manage", () => {
    expect(permissionsForRole("owner")).toContain("permissions:manage");
    expect(permissionsForRole("teacher")).not.toContain("permissions:manage");
  });

  test("grade scales read is staff-only; students/guardians use class:read for subjects", () => {
    expect(permissionsForRole("assistant_teacher")).toContain("gradeScales:read");
    expect(permissionsForRole("teacher")).toContain("gradeScales:manage");
    expect(permissionsForRole("student")).not.toContain("gradeScales:read");
    expect(permissionsForRole("guardian")).not.toContain("gradeScales:read");
    expect(permissionsForRole("student")).toContain("class:read");
    expect(permissionsForRole("guardian")).toContain("class:read");
  });

  test("calendar manage is teacher+; read is on every class role", () => {
    expect(permissionsForRole("class_member")).toContain("calendar:read");
    expect(permissionsForRole("student")).toContain("calendar:read");
    expect(permissionsForRole("teacher")).toContain("calendar:manage");
    expect(permissionsForRole("assistant_teacher")).not.toContain("calendar:manage");
    expect(GRANTABLE_CLASS_PERMISSIONS).toContain("calendar:read");
    expect(GRANTABLE_CLASS_PERMISSIONS).toContain("calendar:manage");
  });

  test("timetable manage is teacher+; read is on every class role", () => {
    expect(permissionsForRole("class_member")).toContain("timetable:read");
    expect(permissionsForRole("student")).toContain("timetable:read");
    expect(permissionsForRole("teacher")).toContain("timetable:manage");
    expect(permissionsForRole("assistant_teacher")).not.toContain("timetable:manage");
    expect(GRANTABLE_CLASS_PERMISSIONS).toContain("timetable:read");
    expect(GRANTABLE_CLASS_PERMISSIONS).toContain("timetable:manage");
  });

  test("classroom screen manage is teacher+; read is on every class role", () => {
    expect(permissionsForRole("class_member")).toContain("classroomScreen:read");
    expect(permissionsForRole("student")).toContain("classroomScreen:read");
    expect(permissionsForRole("teacher")).toContain("classroomScreen:manage");
    expect(permissionsForRole("assistant_teacher")).not.toContain("classroomScreen:manage");
    expect(GRANTABLE_CLASS_PERMISSIONS).toContain("classroomScreen:read");
    expect(GRANTABLE_CLASS_PERMISSIONS).toContain("classroomScreen:manage");
  });

  test("assigners manage is teacher+; view uses class:read", () => {
    expect(permissionsForRole("teacher")).toContain("assigners:manage");
    expect(permissionsForRole("assistant_teacher")).not.toContain("assigners:manage");
    expect(permissionsForRole("student")).not.toContain("assigners:manage");
    expect(GRANTABLE_CLASS_PERMISSIONS).toContain("assigners:manage");
    expect(GRANTABLE_CLASS_PERMISSIONS).not.toContain("assigners:read");
  });
});

describe("permission override helpers", () => {
  test("only teacher and assistant_teacher are override targets", () => {
    expect(isPermissionOverrideTargetRole("teacher")).toBe(true);
    expect(isPermissionOverrideTargetRole("assistant_teacher")).toBe(true);
    expect(isPermissionOverrideTargetRole("owner")).toBe(false);
    expect(isPermissionOverrideTargetRole("student")).toBe(false);
    expect(isPermissionOverrideTargetRole("guardian")).toBe(false);
  });

  test("effectivePermissionEnabled applies deny-wins then grant then role default", () => {
    expect(effectivePermissionEnabled(true, "deny")).toBe(false);
    expect(effectivePermissionEnabled(false, "allow")).toBe(true);
    expect(effectivePermissionEnabled(true, null)).toBe(true);
    expect(effectivePermissionEnabled(false, null)).toBe(false);
  });
});
