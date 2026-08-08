import { useConvexAuth } from "@convex-dev/auth/react";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  summarizeAttendanceCounts,
  type AttendanceStatusSummary,
} from "@/lib/attendance/attendance";
import { ONE_HOUR } from "@/lib/queryCache";

/** gcTime: ONE_HOUR — same as personal attendance history. */
export function useAttendanceSummaryForAudience(classId: Id<"classes">) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

  const query = useQuery({
    ...convexQuery(api.attendance.summaryForAudience, isAuthenticated ? { classId } : "skip"),
    gcTime: ONE_HOUR,
    retry: false,
  });

  const byStudentId = new Map<Id<"users">, AttendanceStatusSummary>();
  if (query.data !== undefined) {
    for (const row of query.data.students) {
      byStudentId.set(
        row.studentUserId,
        summarizeAttendanceCounts({
          present: row.present,
          absent: row.absent,
          late: row.late,
        }),
      );
    }
  }

  const isPending = isAuthLoading || query.isPending;

  return {
    byStudentId,
    isPending,
    isAuthLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
