import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useConvexAuth } from "@convex-dev/auth/react";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";

type UseAuthedQueryOptions<TData> = {
  gcTime: number;
  placeholderData?: TData | ((previousData: TData | undefined) => TData | undefined);
};

/**
 * Auth-gated Convex query wrapper for TanStack Query.
 *
 * Use this when the underlying Convex query is wrapped in `authedQuery`
 * (it throws / requires authentication). This hook ensures we never call
 * the query while logged out by passing `"skip"` to `convexQuery`.
 */
export function useAuthedQuery<ConvexQueryReference extends FunctionReference<"query">>(
  funcRef: ConvexQueryReference,
  args: FunctionArgs<ConvexQueryReference> | "skip",
  options: UseAuthedQueryOptions<FunctionReturnType<ConvexQueryReference>>,
): UseQueryResult<FunctionReturnType<ConvexQueryReference>, Error> & {
  isAuthLoading: boolean;
  isPending: boolean;
} {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

  const result = useQuery({
    ...convexQuery(
      funcRef,
      (isAuthenticated ? args : "skip") as FunctionArgs<ConvexQueryReference> | "skip",
    ),
    gcTime: options.gcTime,
    ...(options.placeholderData !== undefined ? { placeholderData: options.placeholderData } : {}),
    retry: false,
  });

  const isPending = isAuthLoading || result.isPending;

  return Object.assign(result, {
    isAuthLoading,
    isPending,
  }) as UseQueryResult<FunctionReturnType<ConvexQueryReference>, Error> & {
    isAuthLoading: boolean;
    isPending: boolean;
  };
}
