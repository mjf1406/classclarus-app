import { useClassPermissionsContext } from "@/components/permissions/classPermissionsContext";
import type { ClassPermission } from "@/lib/permissions/classPermissions";

export function useCan() {
  const { can, role, isPending, permissions } = useClassPermissionsContext();
  return {
    can: (permission: ClassPermission | string) => can(permission),
    role,
    isPending,
    permissions,
  };
}
