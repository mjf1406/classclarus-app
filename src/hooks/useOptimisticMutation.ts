import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
  type UseMutationOptions,
} from "@tanstack/react-query";

export type OptimisticMutationContext = {
  queryKeys: readonly QueryKey[];
  previousByKey: readonly unknown[];
};

type QueryKeyFactory<TVariables> =
  | readonly QueryKey[]
  | ((variables: TVariables) => readonly QueryKey[]);

type UseOptimisticMutationOptions<TVariables, TResult> = {
  mutationFn: (variables: TVariables) => Promise<TResult>;
  queryKeys: QueryKeyFactory<TVariables>;
  /** Optional — omit for cancel-only / invalidate-only flows. */
  applyOptimisticUpdate?: (
    queryClient: QueryClient,
    variables: TVariables,
    snapshot: OptimisticMutationContext,
  ) => void;
  /** Default true. Set false to skip automatic invalidation of snapshotted keys. */
  onSettledInvalidate?: boolean;
  /** Extra keys to invalidate on settled (in addition to snapshotted keys). */
  invalidateQueryKeys?: QueryKeyFactory<TVariables>;
  /** Runs after rollback. Use for toasts / code-specific messages. */
  onError?: (
    error: Error,
    variables: TVariables,
    context: OptimisticMutationContext | undefined,
  ) => void;
  /** Runs after default invalidation. */
  onSettled?: (
    data: TResult | undefined,
    error: Error | null,
    variables: TVariables,
    context: OptimisticMutationContext | undefined,
  ) => void;
} & Omit<
  UseMutationOptions<TResult, Error, TVariables, OptimisticMutationContext>,
  "mutationFn" | "onMutate" | "onError" | "onSettled"
>;

function resolveQueryKeys<TVariables>(
  factory: QueryKeyFactory<TVariables>,
  variables: TVariables,
): readonly QueryKey[] {
  return typeof factory === "function" ? factory(variables) : factory;
}

/**
 * Generic optimistic mutation helper for TanStack Query + Convex.
 *
 * - onMutate: cancel + snapshot + apply optimistic update
 * - onError: restore snapshot, then call caller onError
 * - onSettled: invalidate snapshotted (+ optional extra) keys, then call caller onSettled
 */
export function useOptimisticMutation<TVariables, TResult>(
  options: UseOptimisticMutationOptions<TVariables, TResult>,
) {
  const queryClient = useQueryClient();
  const {
    mutationFn,
    queryKeys: queryKeysFactory,
    applyOptimisticUpdate,
    onSettledInvalidate,
    invalidateQueryKeys,
    onError: userOnError,
    onSettled: userOnSettled,
    ...rest
  } = options;

  return useMutation<TResult, Error, TVariables, OptimisticMutationContext>({
    ...rest,
    retry: false,
    mutationFn,

    onMutate: async (variables) => {
      const queryKeys = resolveQueryKeys(queryKeysFactory, variables);

      const previousByKey = await Promise.all(
        queryKeys.map(async (queryKey) => {
          await queryClient.cancelQueries({ queryKey });
          return queryClient.getQueryData(queryKey);
        }),
      );

      const snapshot: OptimisticMutationContext = {
        queryKeys,
        previousByKey,
      };

      applyOptimisticUpdate?.(queryClient, variables, snapshot);

      return snapshot;
    },

    onError: (error, variables, context) => {
      if (context) {
        context.queryKeys.forEach((queryKey, index) => {
          const previous = context.previousByKey[index];
          queryClient.setQueryData(queryKey, previous);
        });
      }
      userOnError?.(error, variables, context);
    },

    onSettled: (data, error, variables, context) => {
      if (onSettledInvalidate !== false) {
        const keysToInvalidate =
          context?.queryKeys ?? resolveQueryKeys(queryKeysFactory, variables);
        keysToInvalidate.forEach((queryKey) => {
          void queryClient.invalidateQueries({ queryKey });
        });
      }

      if (invalidateQueryKeys) {
        resolveQueryKeys(invalidateQueryKeys, variables).forEach((queryKey) => {
          void queryClient.invalidateQueries({ queryKey });
        });
      }

      userOnSettled?.(data, error, variables, context);
    },
  });
}
