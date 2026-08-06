import { useEffect, useMemo, useRef, useState } from "react";

import {
  filterActivityIds,
  hasActivityLogFilters,
  toFilterableActivityRow,
  type ActivityLogFilterCriteria,
  type ActivityLogFilterRequest,
  type ActivityLogFilterResponse,
  type FilterableActivityRow,
} from "@/lib/activity/activityLogFilter";

const SEARCH_DEBOUNCE_MS = 250;

type UseActivityLogFilterOptions<T extends { _id: string }> = {
  rows: readonly T[];
  emailQuery: string;
  summaryQuery: string;
  actions: string[];
  roles: string[];
};

type UseActivityLogFilterResult<T> = {
  filtered: T[];
  isFiltering: boolean;
};

function isFilterResult(data: unknown): data is ActivityLogFilterResponse {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as Partial<ActivityLogFilterResponse>;
  return (
    candidate.type === "filterResult" &&
    typeof candidate.requestId === "number" &&
    Array.isArray(candidate.ids)
  );
}

/**
 * Debounces email/summary search (250ms) and runs all activity filters on a Web Worker.
 */
export function useActivityLogFilter<
  T extends {
    _id: string;
    actorEmail: string;
    actorRole: string;
    action: string;
    summary: string;
  },
>({
  rows,
  emailQuery,
  summaryQuery,
  actions,
  roles,
}: UseActivityLogFilterOptions<T>): UseActivityLogFilterResult<T> {
  const items = useMemo(() => [...rows], [rows]);
  const [debouncedEmail, setDebouncedEmail] = useState(() => emailQuery.trim());
  const [debouncedSummary, setDebouncedSummary] = useState(() => summaryQuery.trim());
  const [matchedIds, setMatchedIds] = useState<string[] | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const latestRequestIdRef = useRef(0);
  const itemsRef = useRef<FilterableActivityRow[]>([]);

  itemsRef.current = items.map(toFilterableActivityRow);

  useEffect(() => {
    const trimmed = emailQuery.trim();
    if (!trimmed) {
      setDebouncedEmail("");
      return;
    }
    setIsFiltering(true);
    const timeoutId = window.setTimeout(() => {
      setDebouncedEmail(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [emailQuery]);

  useEffect(() => {
    const trimmed = summaryQuery.trim();
    if (!trimmed) {
      setDebouncedSummary("");
      return;
    }
    setIsFiltering(true);
    const timeoutId = window.setTimeout(() => {
      setDebouncedSummary(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [summaryQuery]);

  // Keep isFiltering honest when text boxes are cleared while other filters remain.
  useEffect(() => {
    if (!emailQuery.trim() && !summaryQuery.trim() && actions.length === 0 && roles.length === 0) {
      setIsFiltering(false);
    }
  }, [emailQuery, summaryQuery, actions.length, roles.length]);

  useEffect(() => {
    if (typeof Worker === "undefined") {
      return;
    }

    const worker = new Worker(
      new URL("../../workers/activityLogFilter.worker.ts", import.meta.url),
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
      setMatchedIds(event.data.ids);
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

  const criteria = useMemo<ActivityLogFilterCriteria>(
    () => ({
      emailQuery: debouncedEmail,
      summaryQuery: debouncedSummary,
      actions,
      roles,
    }),
    [debouncedEmail, debouncedSummary, actions, roles],
  );

  useEffect(() => {
    if (!hasActivityLogFilters(criteria)) {
      setMatchedIds(null);
      setIsFiltering(false);
      return;
    }

    const worker = workerRef.current;
    if (!worker) {
      setMatchedIds(filterActivityIds(itemsRef.current, criteria));
      setIsFiltering(false);
      return;
    }

    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    setIsFiltering(true);

    const message: ActivityLogFilterRequest = {
      type: "filter",
      requestId,
      items: itemsRef.current,
      criteria,
    };
    worker.postMessage(message);
  }, [criteria, items]);

  const filtered = useMemo(() => {
    if (!hasActivityLogFilters(criteria) || matchedIds === null) {
      return items;
    }
    const idSet = new Set(matchedIds);
    return items.filter((item) => idSet.has(item._id));
  }, [items, criteria, matchedIds]);

  return { filtered, isFiltering };
}
