import { useEffect, useMemo, useRef, useState } from "react";

import type { PointsSortDirection } from "@/lib/points/points";
import {
  filterAndSortPointsLedgerIds,
  pointsLedgerItemKey,
  toFilterablePointsLedgerItem,
  type FilterablePointsLedgerItem,
  type PointsLedgerDescriptionFilter,
  type PointsLedgerFilterCriteria,
  type PointsLedgerFilterRequest,
  type PointsLedgerFilterResponse,
  type PointsLedgerSortKey,
} from "@/lib/points/pointsLedgerFilter";

type UsePointsLedgerFilterOptions<T extends { kind: string; id: string; at: number }> = {
  items: readonly T[];
  descriptionFilters: ReadonlySet<PointsLedgerDescriptionFilter>;
  sortKey: PointsLedgerSortKey;
  sortDirection: PointsSortDirection;
};

type UsePointsLedgerFilterResult<T> = {
  filtered: T[];
  isFiltering: boolean;
};

function isFilterResult(data: unknown): data is PointsLedgerFilterResponse {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as Partial<PointsLedgerFilterResponse>;
  return (
    candidate.type === "filterResult" &&
    typeof candidate.requestId === "number" &&
    Array.isArray(candidate.ids)
  );
}

/**
 * Filters by description category and sorts by date/points on a Web Worker.
 * Falls back to the main thread when Worker is unavailable (e.g. some tests).
 */
export function usePointsLedgerFilter<
  T extends {
    kind: "behavior" | "reward" | "warning";
    id: string;
    at: number;
    pointsApplied?: number;
    pointsCost?: number;
  },
>({
  items,
  descriptionFilters,
  sortKey,
  sortDirection,
}: UsePointsLedgerFilterOptions<T>): UsePointsLedgerFilterResult<T> {
  const list = useMemo(() => [...items], [items]);
  const [orderedIds, setOrderedIds] = useState<string[] | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const latestRequestIdRef = useRef(0);
  const itemsRef = useRef<FilterablePointsLedgerItem[]>([]);

  itemsRef.current = list.map(toFilterablePointsLedgerItem);

  const criteria = useMemo<PointsLedgerFilterCriteria>(
    () => ({
      descriptionFilters: [...descriptionFilters],
      sortKey,
      sortDirection,
    }),
    [descriptionFilters, sortDirection, sortKey],
  );

  useEffect(() => {
    if (typeof Worker === "undefined") {
      return;
    }

    const worker = new Worker(
      new URL("../../workers/pointsLedgerFilter.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (!isFilterResult(event.data)) {
        return;
      }
      if (event.data.requestId !== latestRequestIdRef.current) {
        return;
      }
      setOrderedIds(event.data.ids);
      setIsFiltering(false);
    };

    worker.onerror = () => {
      setIsFiltering(false);
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) {
      setOrderedIds(filterAndSortPointsLedgerIds(itemsRef.current, criteria));
      setIsFiltering(false);
      return;
    }

    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    setIsFiltering(true);

    const message: PointsLedgerFilterRequest = {
      type: "filter",
      requestId,
      items: itemsRef.current,
      criteria,
    };
    worker.postMessage(message);
  }, [criteria, list]);

  const filtered = useMemo(() => {
    const ids = orderedIds ?? filterAndSortPointsLedgerIds(itemsRef.current, criteria);
    const byId = new Map(list.map((item) => [pointsLedgerItemKey(item), item]));
    const next: T[] = [];
    for (const id of ids) {
      const item = byId.get(id);
      if (item) next.push(item);
    }
    return next;
  }, [criteria, list, orderedIds]);

  return { filtered, isFiltering };
}
