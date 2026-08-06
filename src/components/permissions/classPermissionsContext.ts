import { createContext, useContext } from "react";

import type { ClassPermission, ClassRole } from "@/lib/permissions/classPermissions";

export type ClassPermissionsContextValue = {
  role: ClassRole | null;
  permissions: ReadonlyArray<string>;
  can: (permission: ClassPermission | string) => boolean;
  isPending: boolean;
};

export const ClassPermissionsContext = createContext<ClassPermissionsContextValue | null>(null);

export function useClassPermissionsContext(): ClassPermissionsContextValue {
  const context = useContext(ClassPermissionsContext);
  if (!context) {
    throw new Error("useClassPermissionsContext must be used within a ClassPermissionsProvider.");
  }
  return context;
}

export function useOptionalClassPermissionsContext(): ClassPermissionsContextValue | null {
  return useContext(ClassPermissionsContext);
}
