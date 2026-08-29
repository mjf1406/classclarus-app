import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export function calendarEventQueryKey(classId: Id<"classes">, eventId: Id<"calendarEvents">) {
  return convexQuery(api.calendar.get, { classId, eventId }).queryKey;
}

/** gcTime: 1 hour — same as calendar range queries. */
export function useCalendarEvent(
  classId: Id<"classes">,
  eventId: Id<"calendarEvents"> | undefined,
) {
  return useAuthedQuery(api.calendar.get, eventId ? { classId, eventId } : "skip", {
    gcTime: GC_TIME.realtime,
  });
}
