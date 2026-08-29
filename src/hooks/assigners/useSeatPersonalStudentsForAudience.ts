import { convexQuery } from "@convex-dev/react-query";

import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { api } from "../../../convex/_generated/api";
import { GC_TIME } from "@/lib/queryCache";

export function seatPersonalStudentsForAudienceQueryKey(classId: Id<"classes">) {
  return convexQuery(api.seatCharts.personalStudentsForAudience, { classId }).queryKey;
}

/** gcTime: GC_TIME.realtime — personal seat-stats picker; Convex keeps the live query fresh while mounted. */
export function useSeatPersonalStudentsForAudience(classId: Id<"classes">) {
  return useAuthedQuery(
    api.seatCharts.personalStudentsForAudience,
    { classId },
    { gcTime: GC_TIME.realtime },
  );
}
