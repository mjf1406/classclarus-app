import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";

export function pointsForAudienceQueryKey(classId: Id<"classes">, dateKey: string) {
  return convexQuery(api.points.forAudience, { classId, dateKey }).queryKey;
}

/** gcTime: ONE_HOUR — same as usePointsBoard; Convex keeps the live query fresh while mounted. */
export function usePointsForAudience(classId: Id<"classes">, dateKey: string) {
  return useAuthedQuery(api.points.forAudience, { classId, dateKey }, { gcTime: ONE_HOUR });
}
