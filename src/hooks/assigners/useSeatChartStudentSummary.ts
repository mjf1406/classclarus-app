import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { FIVE_MINUTES } from "@/lib/queryCache";

export function seatChartStudentSummaryQueryKey(
  classId: Id<"classes">,
  chartId: Id<"seatCharts">,
  studentUserId: Id<"users">,
) {
  return convexQuery(api.seatCharts.studentSummary, {
    classId,
    chartId,
    studentUserId,
  }).queryKey;
}

export function seatChartStudentHistoryQueryKey(
  classId: Id<"classes">,
  chartId: Id<"seatCharts">,
  studentUserId: Id<"users">,
) {
  return ["seatCharts", "studentHistory", classId, chartId, studentUserId] as const;
}

/** gcTime: 5 minutes — student inspector stats. */
export function useSeatChartStudentSummary(
  classId: Id<"classes">,
  chartId: Id<"seatCharts">,
  studentUserId: Id<"users"> | null,
) {
  return useAuthedQuery(
    api.seatCharts.studentSummary,
    studentUserId ? { classId, chartId, studentUserId } : "skip",
    { gcTime: FIVE_MINUTES },
  );
}
