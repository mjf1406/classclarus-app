import { useConvexAuth } from "@convex-dev/auth/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useConvex } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { GC_TIME } from "@/lib/queryCache";

const PAGE_SIZE = 20;

export type EquitablePlacementHistoryFilter = {
  item: string;
  groupName?: string;
};

export function equitableStudentHistoryQueryKey(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners">,
  studentUserId: Id<"users">,
  placementFilter: EquitablePlacementHistoryFilter,
) {
  return [
    "equitableAssigners",
    "studentHistory",
    classId,
    assignerId,
    studentUserId,
    placementFilter.item,
    placementFilter.groupName ?? "",
  ] as const;
}

/** gcTime: GC_TIME.realtime — paginated equitable assignment history for a placement. */
export function useEquitableStudentHistory(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners"> | undefined,
  studentUserId: Id<"users"> | null,
  placementFilter: EquitablePlacementHistoryFilter | null,
) {
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();

  return useInfiniteQuery({
    queryKey:
      assignerId && studentUserId && placementFilter
        ? equitableStudentHistoryQueryKey(classId, assignerId, studentUserId, placementFilter)
        : ["equitableAssigners", "studentHistory", "skip"],
    enabled: isAuthenticated && Boolean(assignerId && studentUserId && placementFilter),
    gcTime: GC_TIME.realtime,
    staleTime: GC_TIME.realtime,
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => {
      if (!assignerId || !studentUserId || !placementFilter) {
        return { items: [], nextBeforeRanAt: undefined };
      }
      return await convex.query(api.equitableAssigners.studentHistory, {
        classId,
        assignerId,
        studentUserId,
        item: placementFilter.item,
        ...(placementFilter.groupName !== undefined
          ? { groupName: placementFilter.groupName }
          : {}),
        limit: PAGE_SIZE,
        ...(pageParam !== undefined ? { beforeRanAt: pageParam } : {}),
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextBeforeRanAt,
    retry: false,
  });
}
