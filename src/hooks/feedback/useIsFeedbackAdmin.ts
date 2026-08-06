import { useConvexAuth } from "@convex-dev/auth/react";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { api } from "../../../convex/_generated/api";
import { isSelfHosted } from "@/lib/selfHosted";

const ONE_MINUTE = 60_000;

/**
 * Whether the signed-in user can manage cloud feedback (`admin:viewFeedback`).
 * Skips the network call on self-host / Electron.
 */
export function useIsFeedbackAdmin() {
  const cloud = !isSelfHosted();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const enabled = cloud && isAuthenticated;

  const result = useQuery({
    ...convexQuery(api.feedback.isFeedbackAdmin, enabled ? {} : "skip"),
    gcTime: ONE_MINUTE,
    retry: false,
  });

  const isPending = isAuthLoading || (enabled && result.isPending);

  return {
    data: result.data,
    isPending,
    isAuthLoading,
    isError: result.isError,
    refetch: result.refetch,
    isAdmin: cloud && (result.data?.isAdmin ?? false),
  };
}
