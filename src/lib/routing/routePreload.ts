import type { EnsureQueryDataOptions, QueryClient, QueryKey } from "@tanstack/react-query";

/** Fire-and-forget Convex preload for intent navigation. */
export function preloadQuery<
  TQueryFnData,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  queryClient: QueryClient,
  queryOptions: EnsureQueryDataOptions<TQueryFnData, TError, TData, TQueryKey>,
) {
  void queryClient.ensureQueryData(queryOptions).catch(() => {});
}

/** Awaited Convex preload for cheap shell queries on navigation. */
export async function awaitPreloadQuery<
  TQueryFnData,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  queryClient: QueryClient,
  queryOptions: EnsureQueryDataOptions<TQueryFnData, TError, TData, TQueryKey>,
) {
  await queryClient.ensureQueryData(queryOptions);
}
