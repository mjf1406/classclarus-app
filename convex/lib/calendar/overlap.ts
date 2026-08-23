import { addDaysToDateKey, dateKeyRangeOverlaps } from "./dateKey.js";
import { startOfZonedDayUtc, utcMsToZonedParts } from "./timeZone.js";

export type CalendarEventSpan = {
  allDay: boolean;
  startAt?: number;
  endAt?: number;
  startDateKey?: string;
  endDateKey?: string;
};

export function timedRangeOverlaps(
  startAt: number,
  endAt: number,
  rangeStartMs: number,
  rangeEndMs: number,
): boolean {
  return startAt < rangeEndMs && endAt > rangeStartMs;
}

export function eventOverlapsRange(
  event: CalendarEventSpan,
  rangeStartMs: number,
  rangeEndMs: number,
  timeZone: string,
): boolean {
  if (rangeEndMs <= rangeStartMs) return false;
  if (event.allDay) {
    if (!event.startDateKey || !event.endDateKey) return false;
    const rangeStartKey = utcMsToZonedParts(rangeStartMs, timeZone).dateKey;
    const lastInstant = rangeEndMs - 1;
    const rangeEndInclusive = utcMsToZonedParts(lastInstant, timeZone).dateKey;
    const rangeEndExclusive = addDaysToDateKey(rangeEndInclusive, 1);
    return dateKeyRangeOverlaps(
      event.startDateKey,
      event.endDateKey,
      rangeStartKey,
      rangeEndExclusive,
    );
  }
  if (event.startAt === undefined || event.endAt === undefined) return false;
  return timedRangeOverlaps(event.startAt, event.endAt, rangeStartMs, rangeEndMs);
}

export function eventOverlapsDateKey(
  event: CalendarEventSpan,
  dateKey: string,
  timeZone: string,
): boolean {
  if (event.allDay) {
    if (!event.startDateKey || !event.endDateKey) return false;
    return event.startDateKey <= dateKey && dateKey < event.endDateKey;
  }
  if (event.startAt === undefined || event.endAt === undefined) return false;
  const dayStart = startOfZonedDayUtc(dateKey, timeZone);
  const dayEnd = startOfZonedDayUtc(addDaysToDateKey(dateKey, 1), timeZone);
  return timedRangeOverlaps(event.startAt, event.endAt, dayStart, dayEnd);
}
