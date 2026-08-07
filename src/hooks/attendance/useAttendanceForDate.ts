import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";

export function attendanceForDateQueryKey(classId: Id<"classes">, dateKey: string) {
  return convexQuery(api.attendance.forDate, { classId, dateKey }).queryKey;
}

/** gcTime: 1 hour — reactive via Convex; keep warm while navigating class pages. */
export function useAttendanceForDate(classId: Id<"classes">, dateKey: string) {
  return useAuthedQuery(api.attendance.forDate, { classId, dateKey }, { gcTime: ONE_HOUR });
}
