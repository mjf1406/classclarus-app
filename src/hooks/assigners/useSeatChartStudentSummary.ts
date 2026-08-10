import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { FIVE_MINUTES } from "@/lib/queryCache";
import type { SeatChartAssignment } from "@/lib/assigners/seatCharts";

export type SeatChartPlacementHistoryFilter = {
  deskItemId: string;
  zoneName?: string;
  teamKey?: string;
};

function summaryAssignmentsArg(assignments: Array<SeatChartAssignment>) {
  return assignments.map((assignment) => ({
    deskItemId: assignment.deskItemId,
    groupId: assignment.groupId,
    studentUserId: assignment.studentUserId,
  }));
}

export function seatChartStudentSummaryQueryKey(
  classId: Id<"classes">,
  chartId: Id<"seatCharts">,
  studentUserId: Id<"users">,
  assignments?: Array<SeatChartAssignment>,
) {
  return convexQuery(api.seatCharts.studentSummary, {
    classId,
    chartId,
    studentUserId,
    ...(assignments ? { assignments: summaryAssignmentsArg(assignments) } : {}),
  }).queryKey;
}

export function seatChartStudentHistoryPrefixQueryKey(
  classId: Id<"classes">,
  chartId: Id<"seatCharts">,
  studentUserId: Id<"users">,
) {
  return ["seatCharts", "studentHistory", classId, chartId, studentUserId] as const;
}

export function seatChartStudentHistoryQueryKey(
  classId: Id<"classes">,
  chartId: Id<"seatCharts">,
  studentUserId: Id<"users">,
  placementFilter: SeatChartPlacementHistoryFilter,
) {
  return [
    ...seatChartStudentHistoryPrefixQueryKey(classId, chartId, studentUserId),
    placementFilter.deskItemId,
    placementFilter.zoneName ?? "",
    placementFilter.teamKey ?? "",
  ] as const;
}

/** gcTime: 5 minutes — student inspector stats. */
export function useSeatChartStudentSummary(
  classId: Id<"classes">,
  chartId: Id<"seatCharts">,
  studentUserId: Id<"users"> | null,
  assignments?: Array<SeatChartAssignment> | null,
) {
  return useAuthedQuery(
    api.seatCharts.studentSummary,
    studentUserId
      ? {
          classId,
          chartId,
          studentUserId,
          ...(assignments ? { assignments: summaryAssignmentsArg(assignments) } : {}),
        }
      : "skip",
    { gcTime: FIVE_MINUTES },
  );
}
