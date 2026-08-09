import { useConvexAuth } from "@convex-dev/auth/react";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ONE_HOUR } from "@/lib/queryCache";

export function hasPermissionOverridesQueryKey(classId: Id<"classes">, userId: Id<"users">) {
  return convexQuery(api.classPermissions.hasPermissionOverrides, { classId, userId }).queryKey;
}

/** gcTime: ONE_HOUR — override flag for role-change confirm; Convex keeps mounted data live. */
export function useHasPermissionOverrides(classId: Id<"classes">, userId: Id<"users"> | null) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const enabled = isAuthenticated && userId !== null;

  const result = useQuery({
    ...convexQuery(
      api.classPermissions.hasPermissionOverrides,
      enabled && userId ? { classId, userId } : "skip",
    ),
    gcTime: ONE_HOUR,
    retry: false,
  });

  return Object.assign(result, {
    isAuthLoading,
    isPending: isAuthLoading || (enabled && result.isPending),
  });
}
