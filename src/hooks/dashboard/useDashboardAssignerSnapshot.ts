import { convexQuery } from "@convex-dev/react-query";

import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { api } from "../../../convex/_generated/api";
import { GC_TIME } from "@/lib/queryCache";

export function dashboardAssignerSnapshotQueryKey(
  classId: Id<"classes">,
  studentUserId: Id<"users">,
) {
  return convexQuery(api.dashboard.assignerSnapshotForAudience, {
    classId,
    studentUserId,
  }).queryKey;
}

/** gcTime: GC_TIME.realtime — assigner snapshot changes infrequently between runs. */
export function useDashboardAssignerSnapshot(
  classId: Id<"classes">,
  studentUserId: Id<"users"> | null,
) {
  return useAuthedQuery(
    api.dashboard.assignerSnapshotForAudience,
    studentUserId !== null ? { classId, studentUserId } : "skip",
    { gcTime: GC_TIME.realtime },
  );
}
