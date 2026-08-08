import { useConvexAuth } from "@convex-dev/auth/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useConvex } from "convex/react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ONE_HOUR } from "@/lib/queryCache";

const PAGE_SIZE = 40;

export type AttendanceHistoryItem = {
  dateKey: string;
  studentUserId: Id<"users">;
  status: "present" | "absent" | "late";
};

type HistoryPageCursor = {
  beforeDateKey: string;
  beforeStudentUserId: Id<"users">;
};

export function attendanceHistoryForAudienceQueryKey(classId: Id<"classes">) {
  return ["attendance", "historyForAudience", classId] as const;
}

/** gcTime: ONE_HOUR — same as personal attendance summary. */
export function useAttendanceHistoryForAudience(classId: Id<"classes">) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const convex = useConvex();

  const query = useInfiniteQuery({
    queryKey: attendanceHistoryForAudienceQueryKey(classId),
    enabled: isAuthenticated,
    gcTime: ONE_HOUR,
    initialPageParam: undefined as HistoryPageCursor | undefined,
    queryFn: async ({ pageParam }) => {
      return await convex.query(api.attendance.historyForAudience, {
        classId,
        limit: PAGE_SIZE,
        ...(pageParam !== undefined
          ? {
              beforeDateKey: pageParam.beforeDateKey,
              beforeStudentUserId: pageParam.beforeStudentUserId,
            }
          : {}),
      });
    },
    getNextPageParam: (lastPage) => {
      if (
        lastPage.nextBeforeDateKey === undefined ||
        lastPage.nextBeforeStudentUserId === undefined
      ) {
        return undefined;
      }
      return {
        beforeDateKey: lastPage.nextBeforeDateKey,
        beforeStudentUserId: lastPage.nextBeforeStudentUserId,
      };
    },
    retry: false,
  });

  const items: AttendanceHistoryItem[] = query.data?.pages.flatMap((page) => page.items) ?? [];
  const isPending = isAuthLoading || query.isPending;

  return {
    items,
    isPending,
    isAuthLoading,
    isError: query.isError,
    refetch: query.refetch,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  };
}
