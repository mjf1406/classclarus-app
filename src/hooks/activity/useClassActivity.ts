import { useConvexAuth } from "@convex-dev/auth/react";
import { convexQuery } from "@convex-dev/react-query";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useMemo } from "react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  ACTIVITY_RECENT_PAGE_SIZE,
  mergeActivityRecentWithPages,
} from "@/lib/activity/activityPagination";
import { GC_TIME } from "@/lib/queryCache";

export const CLASS_ACTIVITY_PAGE_SIZE = ACTIVITY_RECENT_PAGE_SIZE;

type ActivityListPage = FunctionReturnType<typeof api.activity.list>;
export type ClassActivityEvent = ActivityListPage["page"][number];

export function classActivityQueryKey(classId: Id<"classes">) {
  return ["activity", "list", classId] as const;
}

export function classActivityRecentQueryOptions(classId: Id<"classes">) {
  return convexQuery(api.activity.list, {
    classId,
    paginationOpts: { numItems: CLASS_ACTIVITY_PAGE_SIZE, cursor: null },
  });
}

/**
 * Paginated class activity log (newest first).
 * TanStack infinite pages use short gcTime; a live recent-page subscription
 * overlays new events without refetching the full year unless a gap is detected.
 */
export function useClassActivity(classId: Id<"classes">) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const convex = useConvex();

  const recentQuery = useQuery({
    ...convexQuery(
      api.activity.list,
      isAuthenticated
        ? {
            classId,
            paginationOpts: { numItems: CLASS_ACTIVITY_PAGE_SIZE, cursor: null },
          }
        : "skip",
    ),
    gcTime: GC_TIME.realtime,
    retry: false,
  });

  const pagesQuery = useInfiniteQuery({
    queryKey: classActivityQueryKey(classId),
    enabled: isAuthenticated,
    gcTime: GC_TIME.realtime,
    staleTime: GC_TIME.realtime,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      return await convex.query(api.activity.list, {
        classId,
        paginationOpts: {
          numItems: CLASS_ACTIVITY_PAGE_SIZE,
          cursor: pageParam,
        },
      });
    },
    getNextPageParam: (lastPage) => (lastPage.isDone ? undefined : lastPage.continueCursor),
    retry: false,
  });

  const cachedPages = useMemo(
    () => pagesQuery.data?.pages.map((page) => page.page) ?? [],
    [pagesQuery.data],
  );

  const { items: results, hasOverlapGap } = useMemo(() => {
    const recent = recentQuery.data?.page ?? [];
    return mergeActivityRecentWithPages(recent, cachedPages);
  }, [recentQuery.data?.page, cachedPages]);

  const pagesRefetch = pagesQuery.refetch;
  const pagesIsFetching = pagesQuery.isFetching;

  useEffect(() => {
    if (!hasOverlapGap) return;
    if (pagesIsFetching) return;
    void pagesRefetch();
  }, [hasOverlapGap, pagesIsFetching, pagesRefetch]);

  const hasCachedRows = results.length > 0;
  const isPending =
    isAuthLoading || (!hasCachedRows && (pagesQuery.isPending || recentQuery.isPending));
  const isLoadingMore = pagesQuery.isFetchingNextPage || pagesQuery.hasNextPage === true;
  const isRefreshing =
    !isPending &&
    (pagesQuery.isFetching || pagesQuery.isRefetching || recentQuery.isFetching) &&
    !pagesQuery.isFetchingNextPage;

  return {
    results,
    status: pagesQuery.hasNextPage
      ? pagesQuery.isFetchingNextPage
        ? ("LoadingMore" as const)
        : ("CanLoadMore" as const)
      : ("Exhausted" as const),
    hasNextPage: pagesQuery.hasNextPage,
    fetchNextPage: pagesQuery.fetchNextPage,
    isAuthLoading,
    isPending,
    isLoadingMore,
    isRefreshing,
    isError: pagesQuery.isError || recentQuery.isError,
    refetch: async () => {
      await Promise.all([pagesQuery.refetch(), recentQuery.refetch()]);
    },
  };
}
