import { convexQuery } from "@convex-dev/react-query";
import { useMemo } from "react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { pointsBoardTimeZoneOffsetMinutes } from "@/hooks/points/usePointsBoard";
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
    timeZoneOffsetMinutes: pointsBoardTimeZoneOffsetMinutes(),
  });
}

export function pointsForAudienceQueryKey(classId: Id<"classes">, dateKey: string) {
  return pointsForAudienceQueryOptions(classId, dateKey).queryKey;
}

/** gcTime: GC_TIME.realtime — same as usePointsBoard; Convex keeps the live query fresh while mounted. */
export function usePointsForAudience(classId: Id<"classes">, dateKey: string) {
  const timeZoneOffsetMinutes = useMemo(() => pointsBoardTimeZoneOffsetMinutes(), []);
  return useAuthedQuery(
    api.points.forAudience,
    { classId, dateKey, timeZoneOffsetMinutes },
    { gcTime: GC_TIME.realtime },
  );
}
