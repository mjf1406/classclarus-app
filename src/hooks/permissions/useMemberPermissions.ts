import { useConvexAuth } from "@convex-dev/auth/react";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ONE_HOUR } from "@/lib/queryCache";

export function memberPermissionsQueryKey(classId: Id<"classes">, userId: Id<"users">) {
  return convexQuery(api.classPermissions.forMember, { classId, userId }).queryKey;
}

/** gcTime: ONE_HOUR — same as class permission snapshot; Convex keeps mounted data live. */
export function useMemberPermissions(classId: Id<"classes">, userId: Id<"users"> | null) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const enabled = isAuthenticated && userId !== null;

  const result = useQuery({
    ...convexQuery(
      api.classPermissions.forMember,
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
