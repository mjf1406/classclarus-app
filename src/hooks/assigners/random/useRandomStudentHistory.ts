import { useConvexAuth } from "@convex-dev/auth/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useConvex } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ONE_HOUR } from "@/lib/queryCache";

const PAGE_SIZE = 20;

export function randomStudentHistoryQueryKeyPrefix(
  classId: Id<"classes">,
  assignerId: Id<"randomAssigners">,
) {
  return ["randomAssigners", "studentHistory", classId, assignerId] as const;
}

export function randomStudentHistoryQueryKey(
  classId: Id<"classes">,
  assignerId: Id<"randomAssigners">,
  studentUserId: Id<"users">,
  item: string,
) {
  return [...randomStudentHistoryQueryKeyPrefix(classId, assignerId), studentUserId, item] as const;
}

/** gcTime: ONE_HOUR — paginated random assignment history for an item. */
export function useRandomStudentHistory(
  classId: Id<"classes">,
  assignerId: Id<"randomAssigners"> | undefined,
  studentUserId: Id<"users"> | null,
  item: string | null,
) {
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();

  return useInfiniteQuery({
    queryKey:
      assignerId && studentUserId && item
        ? randomStudentHistoryQueryKey(classId, assignerId, studentUserId, item)
        : ["randomAssigners", "studentHistory", "skip"],
    enabled: isAuthenticated && Boolean(assignerId && studentUserId && item),
    gcTime: ONE_HOUR,
    staleTime: ONE_HOUR,
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => {
      if (!assignerId || !studentUserId || !item) {
        return { items: [], nextBeforeRanAt: undefined };
      }
      return await convex.query(api.randomAssigners.studentHistory, {
        classId,
        assignerId,
        studentUserId,
        item,
        limit: PAGE_SIZE,
        ...(pageParam !== undefined ? { beforeRanAt: pageParam } : {}),
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextBeforeRanAt,
    retry: false,
  });
}
