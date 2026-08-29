import { utcMsToZonedParts } from "../calendar/timeZone.js";
import {
  getIsoWeekYearAndNumber,
  getIsoWeekYearAndNumberFromDateKey,
  timeToMinutes,
  weekdayNameFromDateKey,
} from "../timetable/timetableSchema.js";

export const DISPLAY_EARLY_MINUTES = 3;

export type SlotLike = {
  _id: string;
  day: string;
  startTime: string;
  endTime: string;
  disabled?: boolean;
};

export type LessonLike = {
  _id: string;
  year: number;
  weekNumber: number;
  slotId: string;
  subject?: {
    name: string;
    bgColor: string;
    textColor: string;
    iconName?: string;
  } | null;
};

function toNowMs(now: Date | number): number {
  return typeof now === "number" ? now : now.getTime();
}

function toDate(now: Date | number): Date {
  return typeof now === "number" ? new Date(now) : now;
}

export function getCurrentDayName(date: Date = new Date()): string {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

export function getCurrentMinutesOfDay(date: Date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}

function clockInTimeZone(
  now: Date | number,
  timeZone: string,
): { dayName: string; minutesOfDay: number; dateKey: string } {
  const parts = utcMsToZonedParts(toNowMs(now), timeZone);
  return {
    dayName: weekdayNameFromDateKey(parts.dateKey),
    minutesOfDay: parts.hour * 60 + parts.minute,
    dateKey: parts.dateKey,
  };
}

function resolveClock(
  now: Date | number,
  timeZone?: string,
): { dayName: string; minutesOfDay: number } {
  if (timeZone) {
    return clockInTimeZone(now, timeZone);
  }
  const date = toDate(now);
  return {
    dayName: getCurrentDayName(date),
    minutesOfDay: getCurrentMinutesOfDay(date),
  };
}

function resolveIsoWeek(
  now: Date | number,
  timeZone?: string,
): { year: number; weekNumber: number } {
  if (timeZone) {
    return getIsoWeekYearAndNumberFromDateKey(clockInTimeZone(now, timeZone).dateKey);
  }
  return getIsoWeekYearAndNumber(toDate(now));
}

function isActiveSlot(slot: SlotLike, dayName: string, currentMinutes: number) {
  if (slot.disabled) return false;
  if (slot.day !== dayName) return false;
  const start = timeToMinutes(slot.startTime);
  const end = timeToMinutes(slot.endTime);
  return currentMinutes >= start && currentMinutes < end;
}

function isEarlyPreviewSlotAt(slot: SlotLike, dayName: string, currentMinutes: number) {
  if (slot.disabled) return false;
  if (slot.day !== dayName) return false;
  const start = timeToMinutes(slot.startTime);
  return currentMinutes >= start - DISPLAY_EARLY_MINUTES && currentMinutes < start;
}

export function isEarlyPreviewSlot(
  slot: SlotLike,
  now: Date | number = new Date(),
  timeZone?: string,
): boolean {
  const { dayName, minutesOfDay } = resolveClock(now, timeZone);
  return isEarlyPreviewSlotAt(slot, dayName, minutesOfDay);
}

export function minutesUntilSlotStart(
  slot: SlotLike,
  now: Date | number = new Date(),
  timeZone?: string,
): number {
  const start = timeToMinutes(slot.startTime);
  return Math.max(0, start - resolveClock(now, timeZone).minutesOfDay);
}

export function findCurrentSlot(
  slots: SlotLike[],
  now: Date | number = new Date(),
  timeZone?: string,
): SlotLike | null {
  const { dayName, minutesOfDay } = resolveClock(now, timeZone);

  const active = slots.find((slot) => isActiveSlot(slot, dayName, minutesOfDay)) ?? null;
  if (active) return active;

  return slots.find((slot) => isEarlyPreviewSlotAt(slot, dayName, minutesOfDay)) ?? null;
}

export function findLessonForSlot(
  slot: SlotLike,
  lessons: LessonLike[],
  now: Date | number = new Date(),
  timeZone?: string,
): LessonLike | null {
  const { year, weekNumber } = resolveIsoWeek(now, timeZone);

  return (
    lessons.find(
      (lesson) =>
        lesson.slotId === slot._id && lesson.year === year && lesson.weekNumber === weekNumber,
    ) ?? null
  );
}

export function resolveCurrentLesson(
  slots: SlotLike[],
  lessons: LessonLike[],
  disabledSlotIds: Set<string>,
  now: Date | number = new Date(),
  timeZone?: string,
): LessonLike | null {
  const currentSlot = findCurrentSlot(
    slots.filter((slot) => !disabledSlotIds.has(slot._id)),
    now,
    timeZone,
  );
  if (!currentSlot) return null;
  return findLessonForSlot(currentSlot, lessons, now, timeZone);
}
