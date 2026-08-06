import { useEffect, useMemo, useRef, useState } from "react";

import {
  filterClassIds,
  toSearchableClass,
  type ClassSearchRequest,
  type ClassSearchResponse,
  type SearchableClass,
} from "@/lib/classes/classSearch";

const SEARCH_DEBOUNCE_MS = 250;

type UseClassSearchOptions<
  T extends { _id: string; name: string; year: number; description?: string },
> = {
  classes: readonly T[] | undefined;
  query: string;
};

type UseClassSearchResult<T> = {
  filtered: T[];
  isFiltering: boolean;
};

function isSearchResult(data: unknown): data is ClassSearchResponse {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as Partial<ClassSearchResponse>;
  return (
    candidate.type === "searchResult" &&
    typeof candidate.requestId === "number" &&
    Array.isArray(candidate.ids)
  );
}

/**
 * Debounces the search query (250ms trailing) and filters classes on a Web Worker.
 * Empty queries skip the worker and return the full list immediately.
 */
export function useClassSearch<
  T extends { _id: string; name: string; year: number; description?: string },
>({ classes, query }: UseClassSearchOptions<T>): UseClassSearchResult<T> {
  const items = useMemo(() => classes ?? [], [classes]);
  const [debouncedQuery, setDebouncedQuery] = useState(() => query.trim());
  const [matchedIds, setMatchedIds] = useState<string[] | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const latestRequestIdRef = useRef(0);
  const itemsRef = useRef<SearchableClass[]>([]);

  itemsRef.current = items.map(toSearchableClass);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setDebouncedQuery("");
      setMatchedIds(null);
      setIsFiltering(false);
      return;
    }

    setIsFiltering(true);
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(trimmed);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  useEffect(() => {
    if (typeof Worker === "undefined") {
      return;
    }

    const worker = new Worker(new URL("../../workers/classSearch.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<unknown>) => {
      if (!isSearchResult(event.data)) {
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

  useEffect(() => {
    if (!debouncedQuery) {
      setMatchedIds(null);
      setIsFiltering(false);
      return;
    }

    const worker = workerRef.current;
    if (!worker) {
      // Fallback if Worker is unavailable (e.g. some test environments).
      setMatchedIds(filterClassIds(itemsRef.current, debouncedQuery));
      setIsFiltering(false);
      return;
    }

    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    setIsFiltering(true);

    const message: ClassSearchRequest = {
      type: "search",
      requestId,
      query: debouncedQuery,
      items: itemsRef.current,
    };
    worker.postMessage(message);
  }, [debouncedQuery, items]);

  const filtered = useMemo(() => {
    if (!debouncedQuery || matchedIds === null) {
      return [...items];
    }
    const idSet = new Set(matchedIds);
    return items.filter((item) => idSet.has(item._id));
  }, [items, debouncedQuery, matchedIds]);

  return { filtered, isFiltering };
}
