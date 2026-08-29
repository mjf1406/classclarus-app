import { useConvexAuth } from "@convex-dev/auth/react";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { api } from "../../../convex/_generated/api";
import { isSelfHosted } from "@/lib/selfHosted";
import { GC_TIME } from "@/lib/queryCache";

/**
 * Whether the signed-in user can manage self-host users (`admin:manageUsers`).
 * Skips the network call on cloud deployments.
 */
export function useIsAppAdmin() {
  const selfHosted = isSelfHosted();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const enabled = selfHosted && isAuthenticated;

  const result = useQuery({
    ...convexQuery(api.adminUsers.isAppAdmin, enabled ? {} : "skip"),
    gcTime: GC_TIME.stable,
    retry: false,
  });

  const isPending = isAuthLoading || (enabled && result.isPending);

  return {
    data: result.data,
    isPending,
    isAuthLoading,
    isError: result.isError,
    refetch: result.refetch,
    isAdmin: selfHosted && (result.data?.isAdmin ?? false),
  };
}
