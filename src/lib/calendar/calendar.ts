import type { FunctionReturnType } from "convex/server";

import { api } from "../../../convex/_generated/api";
import {
  exclusiveEndToInclusive,
  formatDateKey,
  isValidDateKey,
  isValidTimeHm,
  parseDateKey,
} from "../../../convex/lib/calendar/dateKey";
import { utcMsToZonedParts } from "../../../convex/lib/calendar/timeZone";
import {
  coerceEventDescriptionJson,
  EMPTY_EVENT_DESCRIPTION_JSON,
  type CalendarEventFormValues,
} from "../../../convex/lib/calendar/calendarEventSchema";
import type { Id } from "../../../convex/_generated/dataModel";

export type CalendarEvent = FunctionReturnType<typeof api.calendar.listInRange>[number];

export type CalendarEventSubmitValues = CalendarEventFormValues & {
  attachmentFileIds: Array<Id<"files">>;
};

export {
  MAX_CALENDAR_EVENT_ATTACHMENTS,
  MAX_EVENT_DESCRIPTION_LENGTH,
  MAX_EVENT_TITLE_LENGTH,
} from "../../../convex/lib/calendar/calendarEventSchema";

export const DEFAULT_EVENT_DURATION_MINUTES = 30;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function dateKeyToLocalDate(dateKey: string): Date {
  const parsed = parseDateKey(dateKey);
  if (!parsed) {
    throw new Error("Invalid date");
  }
  return new Date(parsed.year, parsed.month - 1, parsed.day);
}

export function localDateToDateKey(date: Date): string {
  return formatDateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function dateKeyForYearMonth(dateKey: string, year: number, month: number): string {
  const parsed = parseDateKey(dateKey);
  const day = parsed?.day ?? 1;
  const lastDay = new Date(year, month, 0).getDate();
  return formatDateKey(year, month, Math.min(day, lastDay));
}

export function formatDateKeyLocalized(dateKey: string, locale: string): string {
  if (!isValidDateKey(dateKey)) return dateKey;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(dateKeyToLocalDate(dateKey));
}

export function formatEventTimeLabel(
  event: CalendarEvent,
  timeZone: string,
  locale: string,
): string {
  if (event.allDay) {
    const start = event.startDateKey ?? "";
    const endInclusive = event.endDateKey ? exclusiveEndToInclusive(event.endDateKey) : start;
    if (endInclusive && endInclusive !== start) {
      return `${formatDateKeyLocalized(start, locale)} – ${formatDateKeyLocalized(endInclusive, locale)}`;
    }
    return formatDateKeyLocalized(start, locale);
  }
  if (event.startAt === undefined || event.endAt === undefined) return "";
  const start = utcMsToZonedParts(event.startAt, timeZone);
  const end = utcMsToZonedParts(event.endAt, timeZone);
  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  const startTime = timeFmt.format(new Date(event.startAt));
  const endTime = timeFmt.format(new Date(event.endAt));
  if (end.dateKey !== start.dateKey) {
    return `${formatDateKeyLocalized(start.dateKey, locale)} ${startTime} – ${formatDateKeyLocalized(end.dateKey, locale)} ${endTime}`;
  }
  return `${startTime} – ${endTime}`;
}

export function formatTimeHm(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Soonest quarter-hour that is not in the past, in the user's local clock. */
export function ceilToNextQuarterHour(now: Date): Date {
  const result = new Date(now.getTime());
  const remainder = result.getMinutes() % 15;
  const onQuarter = remainder === 0 && result.getSeconds() === 0 && result.getMilliseconds() === 0;
  if (onQuarter) {
    return result;
  }
  result.setSeconds(0, 0);
  result.setMinutes(result.getMinutes() + (remainder === 0 ? 15 : 15 - remainder));
  return result;
}

export function addMinutesToLocalDateTime(
  dateKey: string,
  timeHm: string,
  minutes: number,
): { dateKey: string; timeHm: string } {
  const date = dateKeyToLocalDate(dateKey);
  const hour = Number(timeHm.slice(0, 2));
  const minute = Number(timeHm.slice(3, 5));
  date.setHours(hour, minute + minutes, 0, 0);
  return {
    dateKey: localDateToDateKey(date),
    timeHm: formatTimeHm(date),
  };
}

export function endDateTimeFromStart(
  startDateKey: string,
  startTime: string,
  durationMinutes = DEFAULT_EVENT_DURATION_MINUTES,
): { endDateKey: string; endTime: string } | null {
  if (!isValidDateKey(startDateKey) || !isValidTimeHm(startTime)) {
    return null;
  }
  const next = addMinutesToLocalDateTime(startDateKey, startTime, durationMinutes);
  return { endDateKey: next.dateKey, endTime: next.timeHm };
}

export function defaultTimedRange(
  selectedDateKey: string,
  now = new Date(),
): { startDateKey: string; startTime: string; endDateKey: string; endTime: string } {
  const next = ceilToNextQuarterHour(now);
  const startTime = formatTimeHm(next);
  const nextDateKey = localDateToDateKey(next);
  const localTodayKey = localDateToDateKey(now);
  const startDateKey =
    selectedDateKey === localTodayKey && nextDateKey !== localTodayKey
      ? nextDateKey
      : selectedDateKey;
  const end = addMinutesToLocalDateTime(startDateKey, startTime, DEFAULT_EVENT_DURATION_MINUTES);
  return {
    startDateKey,
    startTime,
    endDateKey: end.dateKey,
    endTime: end.timeHm,
  };
}

export function eventToFormValues(
  event: CalendarEvent,
  classTimeZone: string | undefined,
  now = new Date(),
): CalendarEventFormValues {
  const timed = defaultTimedRange(event.startDateKey ?? localDateToDateKey(now), now);
  if (event.allDay) {
    return {
      title: event.title,
      description: coerceEventDescriptionJson(event.description),
      allDay: true,
      startDateKey: event.startDateKey ?? "",
      startTime: timed.startTime,
      endDateKey: event.endDateKey ? exclusiveEndToInclusive(event.endDateKey) : "",
      endTime: timed.endTime,
      audienceKind: event.audienceKind,
      audienceRoles: event.audienceRoles as CalendarEventFormValues["audienceRoles"],
      reminders: event.reminders.map((reminder) => ({
        amount: reminder.amount,
        unit: reminder.unit,
        notifyRoles:
          reminder.notifyRoles as CalendarEventFormValues["reminders"][number]["notifyRoles"],
      })),
    };
  }
  const timeZone = event.timezone ?? classTimeZone ?? "UTC";
  const start = event.startAt !== undefined ? utcMsToZonedParts(event.startAt, timeZone) : null;
  const end = event.endAt !== undefined ? utcMsToZonedParts(event.endAt, timeZone) : null;
  return {
    title: event.title,
    description: coerceEventDescriptionJson(event.description),
    allDay: false,
    startDateKey: start?.dateKey ?? timed.startDateKey,
    startTime: start?.timeHm ?? timed.startTime,
    endDateKey: end?.dateKey ?? timed.endDateKey,
    endTime: end?.timeHm ?? timed.endTime,
    audienceKind: event.audienceKind,
    audienceRoles: event.audienceRoles as CalendarEventFormValues["audienceRoles"],
    reminders: event.reminders.map((reminder) => ({
      amount: reminder.amount,
      unit: reminder.unit,
      notifyRoles:
        reminder.notifyRoles as CalendarEventFormValues["reminders"][number]["notifyRoles"],
    })),
  };
}

export function defaultEventFormValues(
  selectedDateKey: string,
  allDay = false,
  now = new Date(),
): CalendarEventFormValues {
  const timed = defaultTimedRange(selectedDateKey, now);
  return {
    title: "",
    description: EMPTY_EVENT_DESCRIPTION_JSON,
    allDay,
    startDateKey: timed.startDateKey,
    startTime: timed.startTime,
    endDateKey: timed.endDateKey,
    endTime: timed.endTime,
    audienceKind: "all",
    audienceRoles: [],
    reminders: [],
  };
}

export function eventSortKey(event: CalendarEvent): string {
  if (event.allDay) {
    return `0:${event.startDateKey ?? ""}:${event.title}`;
  }
  return `1:${String(event.startAt ?? 0).padStart(15, "0")}:${event.title}`;
}
