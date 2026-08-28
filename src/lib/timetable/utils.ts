import { compareDateKeys } from "../../../convex/lib/calendar/dateKey";
import {
  formatLocalDateKey,
  getIsoWeekYearAndNumber,
  isEmptyNotesJson,
  parseDateKeyLocal,
  timeToMinutes,
  WEEKDAY_NAMES,
} from "../../../convex/lib/timetable/timetableSchema";

export { timeToMinutes, WEEKDAY_NAMES, isEmptyNotesJson };

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function formatTimeString(time: string, format: "12" | "24" = "24"): string {
  if (format === "24") return time;
  const [hours, minutes] = time.split(":").map(Number);
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const period = hours >= 12 ? "PM" : "AM";
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getSundayOfWeek(date: Date): Date {
  const d = new Date(date);
  const diff = d.getDate() - d.getDay();
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekStart(date: Date, weekStartDay: "sunday" | "monday" = "monday"): Date {
  return weekStartDay === "sunday" ? getSundayOfWeek(date) : getMondayOfWeek(date);
}

export function getWeekdays(weekStartDay: "sunday" | "monday" = "monday"): readonly string[] {
  if (weekStartDay === "sunday") {
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  }
  return WEEKDAY_NAMES;
}

export function getYearAndWeekNumber(date: Date): { year: number; weekNumber: number } {
  return getIsoWeekYearAndNumber(date);
}

export function getPreviousWeek(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() - 7);
  return d;
}

export function getNextWeek(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 7);
  return d;
}

export function getPreviousDay(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return d;
}

export function getNextDay(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d;
}

export function formatWeekRange(weekStart: Date, locale: string): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const fmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
  const yearFmt = new Intl.DateTimeFormat(locale, { year: "numeric" });
  const startStr = fmt.format(weekStart);
  const endStr = fmt.format(end);
  const yearStr = yearFmt.format(end);
  return `${startStr} – ${endStr}, ${yearStr}`;
}

export function formatDayDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function clampWeekStartToTerm(
  weekStart: Date,
  startDateKey: string,
  endDateKey: string,
): Date {
  const start = parseDateKeyLocal(startDateKey);
  const end = parseDateKeyLocal(endDateKey);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  if (weekEnd < start) return getWeekStart(start);
  if (weekStart > end) return getWeekStart(end);
  return weekStart;
}

export function weekOverlapsTerm(
  weekStart: Date,
  startDateKey: string,
  endDateKey: string,
): boolean {
  const weekEndKey = formatLocalDateKey(
    new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6),
  );
  const weekStartKey = formatLocalDateKey(weekStart);
  return (
    compareDateKeys(weekEndKey, startDateKey) >= 0 && compareDateKeys(weekStartKey, endDateKey) <= 0
  );
}

export function slotDurationMinutes(startTime: string, endTime: string): number {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
}

export function sortSlotsByTime<T extends { startTime: string; endTime: string }>(
  slots: Array<T>,
): Array<T> {
  return [...slots].sort((a, b) => {
    const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    if (startDiff !== 0) return startDiff;
    return timeToMinutes(a.endTime) - timeToMinutes(b.endTime);
  });
}

export function weekdayFromDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
}

export function getDateForWeekday(dayName: string, weekStart: Date): Date {
  const index = WEEKDAY_NAMES.indexOf(dayName as (typeof WEEKDAY_NAMES)[number]);
  const d = new Date(weekStart);
  if (index >= 0) {
    d.setDate(d.getDate() + index);
  }
  return d;
}

/** 2024-01-01 is a Monday — matches `WEEKDAY_NAMES` order. */
export function formatWeekdayName(dayName: string, locale: string): string {
  const index = WEEKDAY_NAMES.indexOf(dayName as (typeof WEEKDAY_NAMES)[number]);
  if (index < 0) return dayName;
  return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(new Date(2024, 0, 1 + index));
}

function simplifiedChineseDayMarker(locale: string): string | undefined {
  const lower = locale.toLowerCase().replaceAll("_", "-");
  if (
    lower.startsWith("zh-hant") ||
    lower.startsWith("zh-tw") ||
    lower.startsWith("zh-hk") ||
    lower.startsWith("zh-mo")
  ) {
    return undefined;
  }
  if (
    lower === "zh" ||
    lower.startsWith("zh-hans") ||
    lower.startsWith("zh-cn") ||
    lower.startsWith("zh-sg")
  ) {
    return "号";
  }
  return undefined;
}

/** Day of month with locale markers, e.g. "24", "24日", "24일", "24号". */
export function formatDayOfMonth(date: Date, locale: string): string {
  const parts = new Intl.DateTimeFormat(locale, { day: "numeric" }).formatToParts(date);
  const marker = simplifiedChineseDayMarker(locale);
  if (marker) {
    const day = parts.find((part) => part.type === "day")?.value ?? String(date.getDate());
    return `${day}${marker}`;
  }
  return parts.map((part) => part.value).join("");
}

export function formatWeekdayHeader(dayName: string, weekStart: Date, locale: string): string {
  const date = getDateForWeekday(dayName, weekStart);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
  return `${weekday} ${formatDayOfMonth(date, locale)}`;
}

export function dateOverlapsTerm(date: Date, startDateKey: string, endDateKey: string): boolean {
  const key = formatLocalDateKey(date);
  return compareDateKeys(key, startDateKey) >= 0 && compareDateKeys(key, endDateKey) <= 0;
}

export function getPreviousDayInTerm(date: Date, startDateKey: string): Date | null {
  const prev = getPreviousDay(date);
  if (compareDateKeys(formatLocalDateKey(prev), startDateKey) < 0) return null;
  return prev;
}

export function getNextDayInTerm(date: Date, endDateKey: string): Date | null {
  const next = getNextDay(date);
  if (compareDateKeys(formatLocalDateKey(next), endDateKey) > 0) return null;
  return next;
}
