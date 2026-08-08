import { useEffect, useMemo, useRef, useState } from "react";

import {
  filterPointsCatalogIds,
  toSearchablePointsCatalogItem,
  type PointsCatalogSearchRequest,
  type PointsCatalogSearchResponse,
  type SearchablePointsCatalogItem,
} from "@/lib/points/pointsCatalogSearch";

const SEARCH_DEBOUNCE_MS = 250;

type UsePointsCatalogSearchOptions<
  T extends {
    _id: string;
    name: string;
    description?: string;
  },
> = {
  items: readonly T[] | undefined;
  query: string;
};

type UsePointsCatalogSearchResult<T> = {
  filtered: T[];
  isFiltering: boolean;
};

function isSearchResult(data: unknown): data is PointsCatalogSearchResponse {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as Partial<PointsCatalogSearchResponse>;
  return (
    candidate.type === "searchResult" &&
    typeof candidate.requestId === "number" &&
    Array.isArray(candidate.ids)
  );
}

/**
 * Debounces the search query (250ms trailing) and filters catalog items on a Web Worker.
 * Empty queries skip the worker and return the full list immediately.
 */
export function usePointsCatalogSearch<
  T extends {
    _id: string;
    name: string;
    description?: string;
  },
>({ items, query }: UsePointsCatalogSearchOptions<T>): UsePointsCatalogSearchResult<T> {
  const catalog = useMemo(() => items ?? [], [items]);
  const [debouncedQuery, setDebouncedQuery] = useState(() => query.trim());
  const [matchedIds, setMatchedIds] = useState<string[] | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const latestRequestIdRef = useRef(0);
  const itemsRef = useRef<SearchablePointsCatalogItem[]>([]);

  itemsRef.current = catalog.map(toSearchablePointsCatalogItem);

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

    const worker = new Worker(
      new URL("../../workers/pointsCatalogSearch.worker.ts", import.meta.url),
      { type: "module" },
    );
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
      setMatchedIds(filterPointsCatalogIds(itemsRef.current, debouncedQuery));
      setIsFiltering(false);
      return;
    }

    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    setIsFiltering(true);

    const message: PointsCatalogSearchRequest = {
      type: "search",
      requestId,
      query: debouncedQuery,
      items: itemsRef.current,
    };
    worker.postMessage(message);
  }, [debouncedQuery, catalog]);

  const filtered = useMemo(() => {
    if (!debouncedQuery || matchedIds === null) {
      return [...catalog];
    }
    const idSet = new Set(matchedIds);
    return catalog.filter((item) => idSet.has(item._id));
  }, [catalog, debouncedQuery, matchedIds]);

  return { filtered, isFiltering };
}
