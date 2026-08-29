import { useConvexAuth } from "@convex-dev/auth/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";
import { useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useMemo } from "react";

import { api } from "../../../convex/_generated/api";
import { HISTORY_PAGE_SIZE, type NotificationStatusFilter } from "@/lib/notifications/history";
import { GC_TIME } from "@/lib/queryCache";

export const NOTIFICATION_HISTORY_QUERY_KEY = "notificationHistory";

export type NotificationHistoryPage = FunctionReturnType<typeof api.notifications.listHistory>;
export type NotificationHistoryItem = NotificationHistoryPage["page"][number];

export type NotificationHistoryQueryFilters = {
  searchQuery: string;
  status: NotificationStatusFilter;
  kind?: string;
  classId?: string;
  createdAfterMs?: number;
};

export type NotificationHistoryInfiniteData = InfiniteData<NotificationHistoryPage, string | null>;

export function notificationHistoryQueryKey(filters: NotificationHistoryQueryFilters) {
  return [NOTIFICATION_HISTORY_QUERY_KEY, filters] as const;
}

export function findNotificationHistoryQueryKeys(queryClient: QueryClient): Array<QueryKey> {
  return queryClient
    .getQueryCache()
    .findAll({
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key[0] === NOTIFICATION_HISTORY_QUERY_KEY;
      },
    })
    .map((query) => query.queryKey);
}

function filtersFromQueryKey(queryKey: QueryKey): NotificationHistoryQueryFilters | null {
  const filters = queryKey[1];
  if (typeof filters !== "object" || filters === null) return null;
  return filters as NotificationHistoryQueryFilters;
}

function itemMatchesFilters(
  item: NotificationHistoryItem,
  filters: NotificationHistoryQueryFilters,
): boolean {
  if (filters.status !== "all" && item.statusKey !== filters.status) return false;
  if (filters.kind && item.kind !== filters.kind) return false;
  if (filters.classId && item.classId !== filters.classId) return false;
  if (filters.createdAfterMs !== undefined && item.createdAt < filters.createdAfterMs) {
    return false;
  }
  const query = filters.searchQuery.trim().toLowerCase();
  if (query.length > 0) {
    const haystack = `${item.title} ${item.description ?? ""}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  return true;
}

export function patchNotificationHistory(
  queryClient: QueryClient,
  updater: (item: NotificationHistoryItem) => NotificationHistoryItem | null,
): void {
  for (const queryKey of findNotificationHistoryQueryKeys(queryClient)) {
    const filters = filtersFromQueryKey(queryKey);
    queryClient.setQueryData<NotificationHistoryInfiniteData>(queryKey, (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          page: page.page.map(updater).filter((item): item is NotificationHistoryItem => {
            if (item === null) return false;
            return filters ? itemMatchesFilters(item, filters) : true;
          }),
        })),
      };
    });
  }
}

/** gcTime: 1 hour — user-confirmed for notification history. */
export function useNotificationHistory(filters: NotificationHistoryQueryFilters) {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const convex = useConvex();
  const queryKey = notificationHistoryQueryKey(filters);

  const query = useInfiniteQuery({
    queryKey,
    enabled: isAuthenticated,
    gcTime: GC_TIME.realtime,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      return await convex.query(api.notifications.listHistory, {
        searchQuery: filters.searchQuery,
        status: filters.status,
        ...(filters.kind ? { kind: filters.kind } : {}),
        ...(filters.classId ? { classId: filters.classId } : {}),
        ...(filters.createdAfterMs !== undefined ? { createdAfterMs: filters.createdAfterMs } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
        limit: HISTORY_PAGE_SIZE,
      });
    },
    getNextPageParam: (lastPage) =>
      lastPage.isDone || !lastPage.continueCursor ? undefined : lastPage.continueCursor,
    retry: false,
  });

  const results = useMemo(() => query.data?.pages.flatMap((page) => page.page) ?? [], [query.data]);

  const hasCachedRows = results.length > 0;
  const isPending = isAuthLoading || (!hasCachedRows && query.isPending);

  return {
    results,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isAuthLoading,
    isPending,
    isError: query.isError,
    refetch: query.refetch,
  };
}
