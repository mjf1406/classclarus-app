import { useConvexAuth } from "@convex-dev/auth/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useConvex } from "convex/react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  seatChartStudentHistoryQueryKey,
  type SeatChartPlacementHistoryFilter,
} from "@/hooks/assigners/useSeatChartStudentSummary";
import { FIVE_MINUTES } from "@/lib/queryCache";

const PAGE_SIZE = 20;

/** gcTime: 5 minutes — paginated student seating history for a specific placement. */
export function useSeatChartStudentHistory(
  classId: Id<"classes">,
  chartId: Id<"seatCharts">,
  studentUserId: Id<"users"> | null,
  placementFilter: SeatChartPlacementHistoryFilter | null,
) {
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();

  return useInfiniteQuery({
    queryKey:
      studentUserId !== null && placementFilter !== null
        ? seatChartStudentHistoryQueryKey(classId, chartId, studentUserId, placementFilter)
        : ["seatCharts", "studentHistory", "skip"],
    enabled: isAuthenticated && studentUserId !== null && placementFilter !== null,
    gcTime: FIVE_MINUTES,
    staleTime: FIVE_MINUTES,
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => {
      if (studentUserId === null || placementFilter === null) {
        return { items: [], nextBeforeRecordedAt: undefined };
      }
      return await convex.query(api.seatCharts.studentHistory, {
        classId,
        chartId,
        studentUserId,
        deskItemId: placementFilter.deskItemId,
        ...(placementFilter.zoneName !== undefined ? { zoneName: placementFilter.zoneName } : {}),
        ...(placementFilter.teamKey !== undefined ? { teamKey: placementFilter.teamKey } : {}),
        limit: PAGE_SIZE,
        ...(pageParam !== undefined ? { beforeRecordedAt: pageParam } : {}),
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextBeforeRecordedAt,
    retry: false,
  });
}
