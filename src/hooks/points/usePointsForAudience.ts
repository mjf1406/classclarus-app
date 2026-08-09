import { convexQuery } from "@convex-dev/react-query";
import { useMemo } from "react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { pointsBoardTimeZoneOffsetMinutes } from "@/hooks/points/usePointsBoard";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";

export function pointsForAudienceQueryKey(classId: Id<"classes">, dateKey: string) {
  return convexQuery(api.points.forAudience, {
    classId,
    dateKey,
    timeZoneOffsetMinutes: pointsBoardTimeZoneOffsetMinutes(),
  }).queryKey;
}

/** gcTime: ONE_HOUR — same as usePointsBoard; Convex keeps the live query fresh while mounted. */
export function usePointsForAudience(classId: Id<"classes">, dateKey: string) {
  const timeZoneOffsetMinutes = useMemo(() => pointsBoardTimeZoneOffsetMinutes(), []);
  return useAuthedQuery(
    api.points.forAudience,
    { classId, dateKey, timeZoneOffsetMinutes },
    { gcTime: ONE_HOUR },
  );
}
