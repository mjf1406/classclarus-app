import { useConvexAuth } from "@convex-dev/auth/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useMemo } from "react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ONE_HOUR } from "@/lib/queryCache";

const PAGE_SIZE = 40;

export type PointsLedgerItem = FunctionReturnType<
  typeof api.points.ledgerForAudience
>["items"][number];

export function pointsLedgerForAudienceQueryKey(
  classId: Id<"classes">,
  studentUserId: Id<"users"> | null,
) {
  return ["points", "ledgerForAudience", classId, studentUserId] as const;
}

/** gcTime: ONE_HOUR — same as personal points summary. */
export function usePointsLedgerForAudience(
  classId: Id<"classes">,
  studentUserId: Id<"users"> | null,
) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const convex = useConvex();

  const query = useInfiniteQuery({
    queryKey: pointsLedgerForAudienceQueryKey(classId, studentUserId),
    enabled: isAuthenticated && studentUserId !== null,
    gcTime: ONE_HOUR,
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => {
      if (studentUserId === null) {
        return { items: [] as PointsLedgerItem[] };
      }
      return await convex.query(api.points.ledgerForAudience, {
        classId,
        studentUserId,
        limit: PAGE_SIZE,
        ...(pageParam !== undefined ? { beforeTimestamp: pageParam } : {}),
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextBeforeTimestamp,
    retry: false,
  });

  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const isPending = isAuthLoading || (studentUserId !== null && query.isPending);

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
