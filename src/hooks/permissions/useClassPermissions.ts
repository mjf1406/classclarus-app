import { convexQuery } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { createPermissionChecker, type ClassPermission } from "@/lib/permissions/classPermissions";
import { GC_TIME } from "@/lib/queryCache";

type ClassPermissionsSnapshot = {
  permissions: Array<string>;
};

export function classPermissionsQueryKey(classId: Id<"classes">) {
  return convexQuery(api.permissions.forClass, { classId }).queryKey;
}

export function classPermissionsQueryOptions(classId: Id<"classes">) {
  return convexQuery(api.permissions.forClass, { classId });
}

/** True when the class layout snapshot is already cached and includes `permission`. */
export function cachedClassHasPermission(
  queryClient: QueryClient,
  classId: Id<"classes">,
  permission: ClassPermission | string,
): boolean {
  const snapshot = queryClient.getQueryData<ClassPermissionsSnapshot>(
    classPermissionsQueryKey(classId),
  );
  if (!snapshot) return false;
  return createPermissionChecker(snapshot.permissions)(permission);
}

export function useClassPermissions(classId: Id<"classes">) {
  return useAuthedQuery(api.permissions.forClass, { classId }, { gcTime: GC_TIME.stable });
}
