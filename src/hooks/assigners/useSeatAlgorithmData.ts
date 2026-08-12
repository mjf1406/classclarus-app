import { convexQuery } from "@convex-dev/react-query";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useCallback, useRef } from "react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FIVE_MINUTES } from "@/lib/queryCache";

type AlgorithmHistoryRow = {
  studentUserId: Id<"users">;
  dimension: "seat" | "zone" | "team" | "neighbor";
  key: string;
  count: number;
};

type AlgorithmHistoryPage = {
  page: AlgorithmHistoryRow[];
  isDone: boolean;
  continueCursor: string;
};

function algorithmHistoryQuery(
  classId: Id<"classes">,
  layoutId: Id<"seatLayouts">,
  cursor: string | null,
) {
  return convexQuery(api.seatLayouts.getAlgorithmHistory, {
    classId,
    layoutId,
    paginationOpts: { numItems: 200, cursor },
  });
}

export function seatLayoutAlgorithmHistoryQueryKey(
  classId: Id<"classes">,
  layoutId: Id<"seatLayouts">,
) {
  return algorithmHistoryQuery(classId, layoutId, null).queryKey;
}

/** Imperative TanStack loader for the layout selected in the auto-assign form. */
export function useSeatAlgorithmData() {
  const queryClient = useQueryClient();
  const historyPageKeys = useRef(new Map<string, QueryKey[]>());

  const load = useCallback(
    async (classId: Id<"classes">, layoutId: Id<"seatLayouts">) => {
      const layout = await queryClient.fetchQuery({
        ...convexQuery(api.seatLayouts.get, { classId, layoutId }),
        gcTime: FIVE_MINUTES,
      });
      const layoutAggregateRows: AlgorithmHistoryRow[] = [];
      const pageKeys: QueryKey[] = [];
      let cursor: string | null = null;
      let isDone = false;
      while (!isDone) {
        const query: ReturnType<typeof algorithmHistoryQuery> = algorithmHistoryQuery(
          classId,
          layoutId,
          cursor,
        );
        pageKeys.push(query.queryKey);
        const result: AlgorithmHistoryPage = await queryClient.fetchQuery({
          ...query,
          gcTime: FIVE_MINUTES,
        });
        layoutAggregateRows.push(...result.page);
        cursor = result.continueCursor;
        isDone = result.isDone;
      }
      historyPageKeys.current.set(`${classId}:${layoutId}`, pageKeys);
      return { layout, layoutAggregateRows };
    },
    [queryClient],
  );

  const invalidateHistory = useCallback(
    async (classId: Id<"classes">, layoutId: Id<"seatLayouts">) => {
      const keys = historyPageKeys.current.get(`${classId}:${layoutId}`) ?? [
        seatLayoutAlgorithmHistoryQueryKey(classId, layoutId),
      ];
      await Promise.all(
        keys.map(async (queryKey) => {
          await queryClient.invalidateQueries({ queryKey, exact: true });
        }),
      );
    },
    [queryClient],
  );

  return { load, invalidateHistory };
}
