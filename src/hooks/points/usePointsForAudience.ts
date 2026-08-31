import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { localDateKey } from "@/lib/attendance/dateKey";
import { GC_TIME } from "@/lib/queryCache";

export function pointsForAudienceQueryOptions(
  classId: Id<"classes">,
  dateKey: string = localDateKey(),
) {
  return convexQuery(api.points.forAudience, {
    classId,
    dateKey,
  });
}

export function pointsForAudienceQueryKey(classId: Id<"classes">, dateKey: string) {
  return pointsForAudienceQueryOptions(classId, dateKey).queryKey;
}

/** gcTime: GC_TIME.realtime — same as usePointsBoard; Convex keeps the live query fresh while mounted. */
export function usePointsForAudience(classId: Id<"classes">, dateKey: string) {
  return useAuthedQuery(api.points.forAudience, { classId, dateKey }, { gcTime: GC_TIME.realtime });
}
