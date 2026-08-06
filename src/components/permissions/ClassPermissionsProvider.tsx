import { useMemo, type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";

import {
  ClassPermissionsContext,
  type ClassPermissionsContextValue,
} from "@/components/permissions/classPermissionsContext";
import { useRemoveFileBytesOnAccessLoss } from "@/hooks/files/useFileBytes";
import { useClassPermissions } from "@/hooks/permissions/useClassPermissions";
import { isSubscriptionRequiredError } from "@/lib/billing/errors";
import {
  createPermissionChecker,
  permissionsFromRole,
  type ClassRole,
} from "@/lib/permissions/classPermissions";
import type { Id } from "../../../convex/_generated/dataModel";

type ClassPermissionsProviderProps = {
  children: ReactNode;
  /** Authoritative snapshot from the server (class layout). */
  classId?: Id<"classes">;
  /** Derive permissions from a known role (home list — avoids N queries). */
  role?: ClassRole | null;
};

/**
 * Provides `can(permission)` for a class.
 * Prefer `classId` inside a class; use `role` on list pages.
 */
export function ClassPermissionsProvider({
  children,
  classId,
  role = null,
}: ClassPermissionsProviderProps) {
  if (classId !== undefined) {
    return <ClassPermissionsFromQuery classId={classId}>{children}</ClassPermissionsFromQuery>;
  }

  return <ClassPermissionsFromRole role={role}>{children}</ClassPermissionsFromRole>;
}

function ClassPermissionsFromQuery({
  classId,
  children,
}: {
  classId: Id<"classes">;
  children: ReactNode;
}) {
  const { data, isPending, isError, error } = useClassPermissions(classId);
  const subscriptionRequired = isError && isSubscriptionRequiredError(error);
  useRemoveFileBytesOnAccessLoss(subscriptionRequired);

  const value = useMemo<ClassPermissionsContextValue>(() => {
    const permissions = data?.permissions ?? [];
    return {
      role: (data?.role as ClassRole | null | undefined) ?? null,
      permissions,
      can: createPermissionChecker(permissions),
      isPending: isPending || isError,
    };
  }, [data, isPending, isError]);

  if (subscriptionRequired) {
    return <Navigate to="/billing" replace />;
  }

  return (
    <ClassPermissionsContext.Provider value={value}>{children}</ClassPermissionsContext.Provider>
  );
}

function ClassPermissionsFromRole({
  role,
  children,
}: {
  role: ClassRole | null;
  children: ReactNode;
}) {
  const value = useMemo<ClassPermissionsContextValue>(() => {
    const permissions = permissionsFromRole(role);
    return {
      role,
      permissions,
      can: createPermissionChecker(permissions),
      isPending: false,
    };
  }, [role]);

  return (
    <ClassPermissionsContext.Provider value={value}>{children}</ClassPermissionsContext.Provider>
  );
}
