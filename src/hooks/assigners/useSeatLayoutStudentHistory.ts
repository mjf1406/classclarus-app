import { useConvexAuth } from "@convex-dev/auth/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useConvex } from "convex/react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { SeatLayoutMatrixDimension } from "@/hooks/assigners/useSeatLayoutRosterMatrix";
import { ONE_HOUR } from "@/lib/queryCache";

const PAGE_SIZE = 20;

export function seatLayoutStudentHistoryQueryKeyPrefix(
  classId: Id<"classes">,
  layoutId: Id<"seatLayouts">,
  dimension: SeatLayoutMatrixDimension,
) {
  return ["seatLayouts", "studentHistory", classId, layoutId, dimension] as const;
}

export function seatLayoutStudentHistoryQueryKey(
  classId: Id<"classes">,
  layoutId: Id<"seatLayouts">,
  dimension: SeatLayoutMatrixDimension,
  studentUserId: Id<"users">,
  key: string,
) {
  return [
    ...seatLayoutStudentHistoryQueryKeyPrefix(classId, layoutId, dimension),
    studentUserId,
    key,
  ] as const;
}

/** gcTime: ONE_HOUR — paginated seating occurrence timestamps for a layout dimension key. */
export function useSeatLayoutStudentHistory(
  classId: Id<"classes">,
  layoutId: Id<"seatLayouts"> | undefined,
  dimension: SeatLayoutMatrixDimension,
  studentUserId: Id<"users"> | null,
  key: string | null,
) {
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();

  return useInfiniteQuery({
    queryKey:
      layoutId && studentUserId && key
        ? seatLayoutStudentHistoryQueryKey(classId, layoutId, dimension, studentUserId, key)
        : ["seatLayouts", "studentHistory", "skip"],
    enabled: isAuthenticated && Boolean(layoutId && studentUserId && key),
    gcTime: ONE_HOUR,
    staleTime: ONE_HOUR,
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => {
      if (!layoutId || !studentUserId || !key) {
        return { items: [], nextBeforeRecordedAt: undefined };
      }
      return await convex.query(api.seatLayouts.studentHistory, {
        classId,
        layoutId,
        studentUserId,
        dimension,
        key,
        limit: PAGE_SIZE,
        ...(pageParam !== undefined ? { beforeRecordedAt: pageParam } : {}),
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextBeforeRecordedAt,
    retry: false,
  });
}
