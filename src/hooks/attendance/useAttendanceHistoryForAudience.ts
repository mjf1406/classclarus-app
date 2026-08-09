import { useConvexAuth } from "@convex-dev/auth/react";
import { convexQuery } from "@convex-dev/react-query";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useConvex } from "convex/react";
import { useMemo } from "react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useRevisionRefresh } from "@/hooks/useRevisionRefresh";
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

/** gcTime: ONE_HOUR — same as personal attendance summary; revision tip keeps mounted data fresh. */
export function useAttendanceHistoryForAudience(classId: Id<"classes">) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const convex = useConvex();

  const revisionQuery = useQuery({
    ...convexQuery(
      api.attendance.historyRevisionForAudience,
      isAuthenticated ? { classId } : "skip",
    ),
    gcTime: ONE_HOUR,
    retry: false,
  });

  const query = useInfiniteQuery({
    queryKey: attendanceHistoryForAudienceQueryKey(classId),
    enabled: isAuthenticated,
    gcTime: ONE_HOUR,
    staleTime: ONE_HOUR,
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

  const cachedRevision = query.data?.pages[0]?.revision;
  const liveRevision = revisionQuery.data;

  useRevisionRefresh(
    liveRevision,
    cachedRevision,
    isAuthenticated && !query.isPending && !query.isFetching && !query.isRefetching,
    () => {
      void query.refetch();
    },
  );

  const items: AttendanceHistoryItem[] = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );
  const isPending = isAuthLoading || query.isPending;
  const isRefreshing =
    !isPending && (query.isFetching || query.isRefetching) && !query.isFetchingNextPage;

  return {
    items,
    isPending,
    isRefreshing,
    isAuthLoading,
    isError: query.isError,
    refetch: query.refetch,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
  };
}
