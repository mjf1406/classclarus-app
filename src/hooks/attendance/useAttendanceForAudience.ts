import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export function attendanceForAudienceQueryKey(classId: Id<"classes">, dateKey: string) {
  return convexQuery(api.attendance.forAudience, { classId, dateKey }).queryKey;
}

/** gcTime: 1 hour — same as staff attendance; Convex keeps the live query fresh while mounted. */
export function useAttendanceForAudience(classId: Id<"classes">, dateKey: string) {
  return useAuthedQuery(
    api.attendance.forAudience,
    { classId, dateKey },
    { gcTime: GC_TIME.realtime },
  );
}
