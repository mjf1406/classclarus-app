import type { ClassPermission } from "@/lib/permissions/classPermissions";
import { grantablePermissionGroups } from "@/lib/permissions/classPermissions";

/** i18n key for a grantable permission label (`classes.perm_activity_read`). */
export function permissionLabelKey(permission: string): string {
  return `perm_${permission.replace(":", "_")}`;
}

/** i18n key for a permission resource group (`classes.permGroup_activity`). */
export function permissionGroupLabelKey(resource: string): string {
  return `permGroup_${resource}`;
}

export function groupedGrantablePermissions(): Array<{
  resource: string;
  groupKey: string;
  permissions: Array<{ permission: ClassPermission; labelKey: string }>;
}> {
  return grantablePermissionGroups().map((group) => ({
    resource: group.resource,
    groupKey: permissionGroupLabelKey(group.resource),
    permissions: group.permissions.map((permission) => ({
      permission,
      labelKey: permissionLabelKey(permission),
    })),
  }));
}
