import { useConvexAuth } from "@convex-dev/auth/react";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { api } from "../../../convex/_generated/api";
import { isSelfHosted } from "@/lib/selfHosted";
import { GC_TIME } from "@/lib/queryCache";

export type FeedbackAdminListArgs = {
  archived: boolean;
};

export function feedbackAdminListQueryKey(args: FeedbackAdminListArgs) {
  return convexQuery(api.feedback.list, args).queryKey;
}

/** Cloud feedback inbox. Skips on self-host / logged out. */
export function useFeedbackAdminList(args: FeedbackAdminListArgs) {
  const cloud = !isSelfHosted();
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const enabled = cloud && isAuthenticated;

  const result = useQuery({
    ...convexQuery(api.feedback.list, enabled ? args : "skip"),
    gcTime: GC_TIME.realtime,
    retry: false,
  });

  const isPending = isAuthLoading || (enabled && result.isPending);

  return Object.assign(result, {
    isAuthLoading,
    isPending,
  });
}
