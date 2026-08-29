import { useConvexAuth } from "@convex-dev/auth/react";
import { convexQuery } from "@convex-dev/react-query";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useMemo } from "react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useRevisionRefresh } from "@/hooks/useRevisionRefresh";
import { GC_TIME } from "@/lib/queryCache";

const PAGE_SIZE = 40;

export type PointsLedgerItem = FunctionReturnType<
  typeof api.points.ledgerForAudience
>["items"][number];

type LedgerPage = FunctionReturnType<typeof api.points.ledgerForAudience>;

export function pointsLedgerForAudienceQueryKey(
  classId: Id<"classes">,
  studentUserId: Id<"users"> | null,
) {
  return ["points", "ledgerForAudience", classId, studentUserId] as const;
}

/** gcTime: GC_TIME.realtime — same as personal points summary; revision tip keeps mounted data fresh. */
export function usePointsLedgerForAudience(
  classId: Id<"classes">,
  studentUserId: Id<"users"> | null,
) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const convex = useConvex();

  const revisionQuery = useQuery({
    ...convexQuery(
      api.points.ledgerRevisionForAudience,
      isAuthenticated && studentUserId !== null ? { classId, studentUserId } : "skip",
    ),
    gcTime: GC_TIME.realtime,
    retry: false,
  });

  const query = useInfiniteQuery({
    queryKey: pointsLedgerForAudienceQueryKey(classId, studentUserId),
    enabled: isAuthenticated && studentUserId !== null,
    gcTime: GC_TIME.realtime,
    staleTime: GC_TIME.realtime,
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => {
      if (studentUserId === null) {
        return {
          items: [] as PointsLedgerItem[],
          revision: null,
        } satisfies LedgerPage;
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

  const cachedRevision = query.data?.pages[0]?.revision;
  const liveRevision = studentUserId !== null ? revisionQuery.data : undefined;

  useRevisionRefresh(
    liveRevision,
    cachedRevision,
    isAuthenticated &&
      studentUserId !== null &&
      !query.isPending &&
      !query.isFetching &&
      !query.isRefetching,
    () => {
      void query.refetch();
    },
  );

  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const isPending = isAuthLoading || (studentUserId !== null && query.isPending);
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
