import { convexQuery } from "@convex-dev/react-query";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import type { CalendarEvent } from "@/lib/calendar/calendar";
import { ONE_HOUR } from "@/lib/queryCache";

export function calendarRangeQueryKey(
  classId: Id<"classes">,
  rangeStartMs: number,
  rangeEndMs: number,
) {
  return convexQuery(api.calendar.listInRange, { classId, rangeStartMs, rangeEndMs }).queryKey;
}

export function findCalendarRangeQueryKeys(
  queryClient: QueryClient,
  classId: Id<"classes">,
): Array<QueryKey> {
  return queryClient
    .getQueryCache()
    .findAll({
      predicate: (query) => {
        const key = query.queryKey;
        if (!Array.isArray(key) || key[0] !== "convexQuery") return false;
        const args = key[2];
        return (
          typeof args === "object" &&
          args !== null &&
          "classId" in args &&
          (args as { classId?: unknown }).classId === classId &&
          "rangeStartMs" in args &&
          "rangeEndMs" in args
        );
      },
    })
    .map((query) => query.queryKey);
}

export function patchCalendarRanges(
  queryClient: QueryClient,
  classId: Id<"classes">,
  updater: (events: Array<CalendarEvent>) => Array<CalendarEvent>,
): void {
  for (const queryKey of findCalendarRangeQueryKeys(queryClient, classId)) {
    queryClient.setQueryData<Array<CalendarEvent>>(queryKey, (old) => {
      if (!old) return old;
      return updater(old);
    });
  }
}

/** gcTime: 1 hour — user-confirmed for calendar range queries. */
export function useCalendarEventsInRange(
  classId: Id<"classes">,
  rangeStartMs: number,
  rangeEndMs: number,
) {
  return useAuthedQuery(
    api.calendar.listInRange,
    { classId, rangeStartMs, rangeEndMs },
    { gcTime: ONE_HOUR },
  );
}
