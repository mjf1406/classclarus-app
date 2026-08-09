import { useConvexAuth } from "@convex-dev/auth/react";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import type { Id } from "../../../convex/_generated/dataModel";
import { ONE_HOUR } from "@/lib/queryCache";
import { api } from "../../../convex/_generated/api";

export function razAssessmentHistoryForAudienceQueryKey(
  classId: Id<"classes">,
  studentUserId: Id<"users">,
) {
  return convexQuery(api.raz.assessmentHistoryForAudience, {
    classId,
    studentUserId,
  }).queryKey;
}

/** gcTime: ONE_HOUR — same as useRazForAudience; Convex keeps the live query fresh while mounted. */
export function useRazAssessmentHistoryForAudience(
  classId: Id<"classes">,
  studentUserId: Id<"users"> | null,
) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const active = isAuthenticated && studentUserId !== null;

  const result = useQuery({
    ...convexQuery(
      api.raz.assessmentHistoryForAudience,
      active && studentUserId !== null ? { classId, studentUserId } : "skip",
    ),
    gcTime: ONE_HOUR,
    retry: false,
  });

  return Object.assign(result, {
    isAuthLoading,
    isPending: active && (isAuthLoading || result.isPending),
  });
}
