import { useConvexAuth } from "@convex-dev/auth/react";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { GC_TIME } from "@/lib/queryCache";

export function seatPersonalStatsForAudienceQueryKey(
  classId: Id<"classes">,
  studentUserId: Id<"users">,
) {
  return convexQuery(api.seatCharts.personalStatsForAudience, {
    classId,
    studentUserId,
  }).queryKey;
}

/** gcTime: GC_TIME.realtime — personal seat stats; Convex keeps the live query fresh while mounted. */
export function useSeatPersonalStatsForAudience(
  classId: Id<"classes">,
  studentUserId: Id<"users"> | null,
) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const active = isAuthenticated && studentUserId !== null;

  const result = useQuery({
    ...convexQuery(
      api.seatCharts.personalStatsForAudience,
      active && studentUserId !== null ? { classId, studentUserId } : "skip",
    ),
    gcTime: GC_TIME.realtime,
    retry: false,
  });

  return Object.assign(result, {
    isAuthLoading,
    isPending: active && (isAuthLoading || result.isPending),
  });
}
