import { useInfiniteQuery } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { useConvexAuth } from "@convex-dev/auth/react";

import { api } from "../../../convex/_generated/api";
import { FIVE_MINUTES } from "@/lib/queryCache";

export const billingHistoryQueryKey = ["billing", "orderHistory"] as const;

const PAGE_SIZE = 10;

/** Order history from Polar — 5-minute gcTime matches entitlement freshness. */
export function useBillingHistory() {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const listOrders = useAction(api.billingActions.listOrders);

  const query = useInfiniteQuery({
    queryKey: billingHistoryQueryKey,
    enabled: isAuthenticated,
    gcTime: FIVE_MINUTES,
    staleTime: FIVE_MINUTES,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) =>
      listOrders({
        page: pageParam,
        limit: PAGE_SIZE,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.maxPage ? lastPage.page + 1 : undefined,
    retry: false,
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
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
