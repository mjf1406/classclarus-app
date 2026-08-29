import { convexQuery } from "@convex-dev/react-query";
import { useEffect, useMemo, useRef } from "react";
import { useConvexMutation } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { localDateKey } from "@/lib/attendance/dateKey";
import { GC_TIME } from "@/lib/queryCache";

export function pointsBoardTimeZoneOffsetMinutes(): number {
  return new Date().getTimezoneOffset();
}

export function pointsBoardQueryKey(classId: Id<"classes">, dateKey: string) {
  return convexQuery(api.points.board, {
    classId,
    dateKey,
    timeZoneOffsetMinutes: pointsBoardTimeZoneOffsetMinutes(),
  }).queryKey;
}

export function pointsBoardQueryOptions(classId: Id<"classes">, dateKey: string = localDateKey()) {
  return convexQuery(api.points.board, {
    classId,
    dateKey,
    timeZoneOffsetMinutes: pointsBoardTimeZoneOffsetMinutes(),
  });
}

/** gcTime: GC_TIME.realtime — same as roster/attendance; Convex keeps the live query fresh while mounted. */
export function usePointsBoard(classId: Id<"classes">, dateKey: string) {
  const timeZoneOffsetMinutes = useMemo(() => pointsBoardTimeZoneOffsetMinutes(), []);
  return useAuthedQuery(
    api.points.board,
    { classId, dateKey, timeZoneOffsetMinutes },
    { gcTime: GC_TIME.realtime },
  );
}

/** Idempotent backfill of missing roster point counters once per class mount. */
export function useEnsurePointsCounters(classId: Id<"classes">, enabled: boolean) {
  const ensure = useConvexMutation(api.points.ensureCounters);
  const ranForClass = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (ranForClass.current === classId) return;
    ranForClass.current = classId;
    void ensure({ classId }).catch(() => {
      ranForClass.current = null;
    });
  }, [classId, enabled, ensure]);
}
