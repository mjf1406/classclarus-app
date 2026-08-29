import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export function assignmentScoresQueryKey(classId: Id<"classes">, assignmentId: Id<"assignments">) {
  return convexQuery(api.assignmentScores.listScores, { classId, assignmentId }).queryKey;
}

/** gcTime: 5 minutes — reactive via Convex; moderate cache after unmount. */
export function useAssignmentScores(classId: Id<"classes">, assignmentId: Id<"assignments">) {
  return useAuthedQuery(
    api.assignmentScores.listScores,
    { classId, assignmentId },
    { gcTime: GC_TIME.realtime },
  );
}
