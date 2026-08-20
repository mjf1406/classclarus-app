import { useConvexAuth } from "@convex-dev/auth/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useConvex } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ONE_HOUR } from "@/lib/queryCache";

const PAGE_SIZE = 20;

export function equitablePartnerHistoryQueryKeyPrefix(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners">,
) {
  return ["equitableAssigners", "partnerHistory", classId, assignerId] as const;
}

export function equitablePartnerHistoryQueryKey(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners">,
  studentUserId: Id<"users">,
  partnerUserId: Id<"users">,
) {
  return [
    ...equitablePartnerHistoryQueryKeyPrefix(classId, assignerId),
    studentUserId,
    partnerUserId,
  ] as const;
}

/** gcTime: ONE_HOUR — paginated shared-job dates for a student/partner pair. */
export function useEquitablePartnerHistory(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners"> | undefined,
  studentUserId: Id<"users"> | null,
  partnerUserId: Id<"users"> | null,
) {
  const { isAuthenticated } = useConvexAuth();
  const convex = useConvex();

  return useInfiniteQuery({
    queryKey:
      assignerId && studentUserId && partnerUserId
        ? equitablePartnerHistoryQueryKey(classId, assignerId, studentUserId, partnerUserId)
        : ["equitableAssigners", "partnerHistory", "skip"],
    enabled: isAuthenticated && Boolean(assignerId && studentUserId && partnerUserId),
    gcTime: ONE_HOUR,
    staleTime: ONE_HOUR,
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => {
      if (!assignerId || !studentUserId || !partnerUserId) {
        return { items: [], nextBeforeRanAt: undefined };
      }
      return await convex.query(api.equitableAssigners.partnerHistory, {
        classId,
        assignerId,
        studentUserId,
        partnerUserId,
        limit: PAGE_SIZE,
        ...(pageParam !== undefined ? { beforeRanAt: pageParam } : {}),
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextBeforeRanAt,
    retry: false,
  });
}
