import { useEffect, useMemo, useRef, useState } from "react";

import type { GroupTeamFilterState, MembershipByUserId } from "@/lib/groups/groupTeamFilters";
import {
  filterStudentRosterIds,
  hasStudentRosterFilters,
  toFilterableRosterStudent,
  toStudentRosterFilterCriteria,
  type FilterableRosterStudent,
  type StudentRosterFilterCriteria,
  type StudentRosterFilterRequest,
  type StudentRosterFilterResponse,
} from "@/lib/students/studentRosterFilter";

const SEARCH_DEBOUNCE_MS = 250;

type UseStudentRosterFilterOptions<
  T extends {
    userId: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  },
> = {
  members: readonly T[] | undefined;
  query: string;
  membershipByUserId: MembershipByUserId;
  filterState: GroupTeamFilterState;
};

type UseStudentRosterFilterResult<T> = {
  filtered: T[];
  isFiltering: boolean;
};

function isFilterResult(data: unknown): data is StudentRosterFilterResponse {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const candidate = data as Partial<StudentRosterFilterResponse>;
  return (
    candidate.type === "filterResult" &&
    typeof candidate.requestId === "number" &&
    Array.isArray(candidate.ids)
  );
}

/**
 * Debounces text search (250ms) and applies group/team + search filters on a Web Worker.
 * Group/team toggles apply immediately. Empty criteria skip the worker.
 */
export function useStudentRosterFilter<
  T extends {
    userId: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  },
>({
  members,
  query,
  membershipByUserId,
  filterState,
}: UseStudentRosterFilterOptions<T>): UseStudentRosterFilterResult<T> {
  const items = useMemo(() => members ?? [], [members]);
  const [debouncedQuery, setDebouncedQuery] = useState(() => query.trim());
  const [matchedIds, setMatchedIds] = useState<string[] | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const latestRequestIdRef = useRef(0);
  const itemsRef = useRef<FilterableRosterStudent[]>([]);
  const membershipRef = useRef<MembershipByUserId>({});

  itemsRef.current = items.map(toFilterableRosterStudent);
  membershipRef.current = membershipByUserId;

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setDebouncedQuery("");
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

  const criteria = useMemo<StudentRosterFilterCriteria>(
    () => toStudentRosterFilterCriteria(filterState, debouncedQuery),
    [filterState, debouncedQuery],
  );

  useEffect(() => {
    if (!query.trim() && !hasStudentRosterFilters(criteria)) {
      setIsFiltering(false);
    }
  }, [query, criteria]);

  useEffect(() => {
    if (typeof Worker === "undefined") {
      return;
    }

    const worker = new Worker(
      new URL("../../workers/studentRosterFilter.worker.ts", import.meta.url),
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

  useEffect(() => {
    if (!hasStudentRosterFilters(criteria)) {
      setMatchedIds(null);
      setIsFiltering(false);
      return;
    }

    const worker = workerRef.current;
    if (!worker) {
      setMatchedIds(filterStudentRosterIds(itemsRef.current, membershipRef.current, criteria));
      setIsFiltering(false);
      return;
    }

    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    setIsFiltering(true);

    const message: StudentRosterFilterRequest = {
      type: "filter",
      requestId,
      items: itemsRef.current,
      membershipByUserId: membershipRef.current,
      criteria,
    };
    worker.postMessage(message);
  }, [criteria, items, membershipByUserId]);

  const filtered = useMemo(() => {
    if (!hasStudentRosterFilters(criteria) || matchedIds === null) {
      return [...items];
    }
    const idSet = new Set(matchedIds);
    return items.filter((item) => idSet.has(item.userId));
  }, [items, criteria, matchedIds]);

  return { filtered, isFiltering };
}
