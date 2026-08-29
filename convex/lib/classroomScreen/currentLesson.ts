import { getIsoWeekYearAndNumber, timeToMinutes } from "../timetable/timetableSchema.js";

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
  notesJson?: string;
};

export function getCurrentDayName(date: Date = new Date()): string {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

export function getCurrentMinutesOfDay(date: Date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
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

export function isEarlyPreviewSlot(slot: SlotLike, now: Date = new Date()): boolean {
  const dayName = getCurrentDayName(now);
  const currentMinutes = getCurrentMinutesOfDay(now);
  return isEarlyPreviewSlotAt(slot, dayName, currentMinutes);
}

export function minutesUntilSlotStart(slot: SlotLike, now: Date = new Date()): number {
  const start = timeToMinutes(slot.startTime);
  return Math.max(0, start - getCurrentMinutesOfDay(now));
}

export function findCurrentSlot(slots: SlotLike[], now: Date = new Date()): SlotLike | null {
  const dayName = getCurrentDayName(now);
  const currentMinutes = getCurrentMinutesOfDay(now);

  const active = slots.find((slot) => isActiveSlot(slot, dayName, currentMinutes)) ?? null;
  if (active) return active;

  return slots.find((slot) => isEarlyPreviewSlotAt(slot, dayName, currentMinutes)) ?? null;
}

export function findLessonForSlot(
  slot: SlotLike,
  lessons: LessonLike[],
  now: Date = new Date(),
): LessonLike | null {
  const { year, weekNumber } = getIsoWeekYearAndNumber(now);

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
  now: Date = new Date(),
): LessonLike | null {
  const currentSlot = findCurrentSlot(
    slots.filter((slot) => !disabledSlotIds.has(slot._id)),
    now,
  );
  if (!currentSlot) return null;
  return findLessonForSlot(currentSlot, lessons, now);
}
