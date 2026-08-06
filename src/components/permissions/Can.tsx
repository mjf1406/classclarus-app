import type { ReactNode } from "react";

import { useCan } from "@/hooks/permissions/useCan";
import type { ClassPermission } from "@/lib/permissions/classPermissions";

type CanProps = {
  permission: ClassPermission;
  children: ReactNode;
};

/** Renders children only when allowed; nothing while pending or denied. */
export function Can({ permission, children }: CanProps) {
  const { can, isPending } = useCan();
  if (isPending || !can(permission)) {
    return null;
  }
  return children;
}
