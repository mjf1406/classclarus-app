import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";

/** gcTime: 1 hour — same as calendar range queries. */
export function useCalendarEvent(
  classId: Id<"classes">,
  eventId: Id<"calendarEvents"> | undefined,
) {
  return useAuthedQuery(api.calendar.get, eventId ? { classId, eventId } : "skip", {
    gcTime: ONE_HOUR,
  });
}
