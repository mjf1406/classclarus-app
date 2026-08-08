import { convexQuery } from "@convex-dev/react-query";
import { useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { TEN_SECONDS } from "@/lib/queryCache";

export function rewardPurchaseLimitsQueryKeyRoot() {
  return ["convexQuery", api.points.rewardPurchaseLimits] as const;
}

/** gcTime: 10 seconds — short-lived; fetched when redeem UI opens for selected students. */
export function useRewardPurchaseLimits(
  classId: Id<"classes">,
  studentUserIds: ReadonlyArray<Id<"users">>,
  enabled: boolean,
) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const timeZoneOffsetMinutes = useMemo(() => new Date().getTimezoneOffset(), []);
  const sortedStudentUserIds = useMemo(() => [...studentUserIds].sort(), [studentUserIds]);

  const args =
    enabled && isAuthenticated && sortedStudentUserIds.length > 0
      ? {
          classId,
          studentUserIds: sortedStudentUserIds,
          timeZoneOffsetMinutes,
        }
      : "skip";

  const result = useQuery({
    ...convexQuery(api.points.rewardPurchaseLimits, args),
    gcTime: TEN_SECONDS,
    retry: false,
  });

  const active = enabled && sortedStudentUserIds.length > 0;

  return Object.assign(result, {
    isAuthLoading,
    isPending: active && (isAuthLoading || result.isPending),
    timeZoneOffsetMinutes,
  });
}
