import { useConvexAuth } from "@convex-dev/auth/react";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FIVE_MINUTES } from "@/lib/queryCache";

export function releasedAssignmentScoreQueryKey(
  classId: Id<"classes">,
  assignmentId: Id<"assignments">,
  studentUserId: Id<"users">,
) {
  return convexQuery(api.assignmentScores.getReleasedScore, {
    classId,
    assignmentId,
    studentUserId,
  }).queryKey;
}

/**
 * Student/guardian score for one assignment when scores are released.
 * gcTime: 5 minutes — reactive via Convex; moderate cache after unmount.
 */
export function useReleasedAssignmentScore(
  classId: Id<"classes">,
  assignmentId: Id<"assignments">,
  studentUserId: Id<"users"> | null | undefined,
  enabled: boolean,
) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const active = enabled && Boolean(studentUserId) && isAuthenticated;

  const result = useQuery({
    ...convexQuery(
      api.assignmentScores.getReleasedScore,
      active && studentUserId ? { classId, assignmentId, studentUserId } : "skip",
    ),
    gcTime: FIVE_MINUTES,
    retry: false,
  });

  return Object.assign(result, {
    isAuthLoading,
    isPending: active && (isAuthLoading || result.isPending),
  });
}
