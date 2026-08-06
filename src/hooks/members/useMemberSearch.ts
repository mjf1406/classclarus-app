import { useEffect, useMemo, useRef, useState } from "react";

import {
  filterMemberIds,
  toSearchableMember,
  type MemberSearchRequest,
  type MemberSearchResponse,
  type SearchableMember,
} from "@/lib/members/memberSearch";

const SEARCH_DEBOUNCE_MS = 250;

type UseMemberSearchOptions<T extends { userId: string; name?: string; email?: string }> = {
  members: readonly T[] | undefined;
  query: string;
};

type UseMemberSearchResult<T> = {
  filtered: T[];
  isFiltering: boolean;
};

function isSearchResult(data: unknown): data is MemberSearchResponse {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as Partial<MemberSearchResponse>;
  return (
    candidate.type === "searchResult" &&
    typeof candidate.requestId === "number" &&
    Array.isArray(candidate.ids)
  );
}

/**
 * Debounces the search query (250ms trailing) and filters members on a Web Worker.
 * Empty queries skip the worker and return the full list immediately.
 */
export function useMemberSearch<T extends { userId: string; name?: string; email?: string }>({
  members,
  query,
}: UseMemberSearchOptions<T>): UseMemberSearchResult<T> {
  const items = useMemo(() => members ?? [], [members]);
  const [debouncedQuery, setDebouncedQuery] = useState(() => query.trim());
  const [matchedIds, setMatchedIds] = useState<string[] | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const latestRequestIdRef = useRef(0);
  const itemsRef = useRef<SearchableMember[]>([]);

  itemsRef.current = items.map(toSearchableMember);

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

    const worker = new Worker(new URL("../../workers/memberSearch.worker.ts", import.meta.url), {
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
      setMatchedIds(filterMemberIds(itemsRef.current, debouncedQuery));
      setIsFiltering(false);
      return;
    }

    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    setIsFiltering(true);

    const message: MemberSearchRequest = {
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
    return items.filter((item) => idSet.has(item.userId));
  }, [items, debouncedQuery, matchedIds]);

  return { filtered, isFiltering };
}
