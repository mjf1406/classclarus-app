import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export function seatChartRecordQueryKey(classId: Id<"classes">, recordId: Id<"seatChartRecords">) {
  return convexQuery(api.seatCharts.getRecord, { classId, recordId }).queryKey;
}

/** gcTime: 5 minutes — frozen seating snapshot. */
export function useSeatChartRecord(
  classId: Id<"classes">,
  recordId: Id<"seatChartRecords"> | null,
) {
  return useAuthedQuery(api.seatCharts.getRecord, recordId ? { classId, recordId } : "skip", {
    gcTime: GC_TIME.realtime,
  });
}
