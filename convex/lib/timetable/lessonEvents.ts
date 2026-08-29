import { v } from "convex/values";

import type { Id } from "../../_generated/dataModel.js";
import { addDaysToDateKey } from "../calendar/dateKey.js";
import { eventOverlapsRange } from "../calendar/overlap.js";
import { startOfZonedDayUtc } from "../calendar/timeZone.js";
import type { CalendarAudienceRole } from "../calendar/audience.js";
import { calendarAudienceRolesOrDefault } from "./sectionItems.js";
import { dateKeyFromIsoWeek, WEEKDAY_NAMES, type WeekdayName } from "./timetableSchema.js";

export const UPCOMING_LESSON_EVENT_LIMIT = 3;
export const UPCOMING_LESSON_EVENT_LOOKAHEAD_DAYS = 90;

export const upcomingLessonEventValidator = v.object({
  _id: v.id("calendarEvents"),
  title: v.string(),
  allDay: v.boolean(),
  startAt: v.optional(v.number()),
  endAt: v.optional(v.number()),
  startDateKey: v.optional(v.string()),
  endDateKey: v.optional(v.string()),
});

export type UpcomingLessonEvent = {
  _id: Id<"calendarEvents">;
  title: string;
  allDay: boolean;
  startAt?: number;
  endAt?: number;
  startDateKey?: string;
  endDateKey?: string;
};

export type LessonEventSource = {
  _id: Id<"calendarEvents">;
  title: string;
  allDay: boolean;
  startAt?: number;
  endAt?: number;
  startDateKey?: string;
  endDateKey?: string;
  audienceKind: "all" | "roles";
  audienceRoles: ReadonlyArray<string>;
};

export function eventMatchesSubjectAudience(
  event: Pick<LessonEventSource, "audienceKind" | "audienceRoles">,
  targetRoles: ReadonlyArray<CalendarAudienceRole>,
): boolean {
  if (event.audienceKind === "all") return true;
  return event.audienceRoles.some((role) => targetRoles.includes(role as CalendarAudienceRole));
}

export function eventIsUpcomingFromDateKey(
  event: LessonEventSource,
  dateKey: string,
  timeZone: string,
): boolean {
  if (event.allDay) {
    const startKey = event.startDateKey ?? dateKey;
    const endExclusive = event.endDateKey ?? addDaysToDateKey(startKey, 1);
    return endExclusive > dateKey;
  }
  const dayStart = startOfZonedDayUtc(dateKey, timeZone);
  const endAt = event.endAt ?? event.startAt ?? 0;
  return endAt >= dayStart;
}

export function lessonEventSortKey(event: LessonEventSource): string {
  if (event.allDay) {
    return `0:${event.startDateKey ?? ""}:${event.title}`;
  }
  return `1:${String(event.startAt ?? 0).padStart(15, "0")}:${event.title}`;
}

export function selectUpcomingLessonEvents(
  events: ReadonlyArray<LessonEventSource>,
  dateKey: string,
  timeZone: string,
  targetRoles: ReadonlyArray<string> | undefined,
  limit = UPCOMING_LESSON_EVENT_LIMIT,
): Array<UpcomingLessonEvent> {
  const roles = calendarAudienceRolesOrDefault(targetRoles);
  const rangeStartMs = startOfZonedDayUtc(dateKey, timeZone);
  const rangeEndMs = startOfZonedDayUtc(
    addDaysToDateKey(dateKey, UPCOMING_LESSON_EVENT_LOOKAHEAD_DAYS),
    timeZone,
  );

  return events
    .filter(
      (event) =>
        eventMatchesSubjectAudience(event, roles) &&
        eventIsUpcomingFromDateKey(event, dateKey, timeZone) &&
        eventOverlapsRange(event, rangeStartMs, rangeEndMs, timeZone),
    )
    .sort((a, b) => lessonEventSortKey(a).localeCompare(lessonEventSortKey(b)))
    .slice(0, limit)
    .map((event) => ({
      _id: event._id,
      title: event.title,
      allDay: event.allDay,
      ...(event.startAt !== undefined ? { startAt: event.startAt } : {}),
      ...(event.endAt !== undefined ? { endAt: event.endAt } : {}),
      ...(event.startDateKey !== undefined ? { startDateKey: event.startDateKey } : {}),
      ...(event.endDateKey !== undefined ? { endDateKey: event.endDateKey } : {}),
    }));
}

export function lessonDateKeyFromSlot(
  year: number,
  weekNumber: number,
  day: string,
): string | null {
  if (!(WEEKDAY_NAMES as ReadonlyArray<string>).includes(day)) return null;
  return dateKeyFromIsoWeek(year, weekNumber, day as WeekdayName);
}
