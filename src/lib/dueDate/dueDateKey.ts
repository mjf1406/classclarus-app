import { localDateKey } from "@/lib/attendance/dateKey";

/** Local due date (`YYYY-MM-DD`) or datetime (`YYYY-MM-DDTHH:mm`, optional seconds). */
const DUE_DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;

function isValidCalendarParts(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Normalize to date-only or minute-precision datetime. */
export function normalizeDueDateKey(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || !DUE_DATE_KEY_RE.test(trimmed)) return null;

  const year = Number(trimmed.slice(0, 4));
  const month = Number(trimmed.slice(5, 7));
  const day = Number(trimmed.slice(8, 10));
  if (!isValidCalendarParts(year, month, day)) return null;

  if (trimmed.length === 10) return trimmed;

  const hour = Number(trimmed.slice(11, 13));
  const minute = Number(trimmed.slice(14, 16));
  if (hour > 23 || minute > 59) return null;
  if (trimmed.length >= 19) {
    const second = Number(trimmed.slice(17, 19));
    if (second > 59) return null;
  }
  return trimmed.slice(0, 16);
}

export function isValidDueDateKey(value: string): boolean {
  return normalizeDueDateKey(value) !== null;
}

export function dueDateKeyHasTime(dueDateKey: string): boolean {
  return dueDateKey.length > 10;
}

/** Parse a local due date/datetime key into a Date in the user's timezone. */
export function parseDueDateKey(dueDateKey: string): Date | null {
  const normalized = normalizeDueDateKey(dueDateKey);
  if (!normalized) return null;
  const year = Number(normalized.slice(0, 4));
  const month = Number(normalized.slice(5, 7));
  const day = Number(normalized.slice(8, 10));
  if (dueDateKeyHasTime(normalized)) {
    const hour = Number(normalized.slice(11, 13));
    const minute = Number(normalized.slice(14, 16));
    return new Date(year, month - 1, day, hour, minute);
  }
  return new Date(year, month - 1, day);
}

/** Coerce legacy date-only keys so `datetime-local` inputs accept them. */
export function coerceDueDateKeyForInput(dueDateKey: string | undefined): string {
  if (!dueDateKey) return "";
  const normalized = normalizeDueDateKey(dueDateKey);
  if (!normalized) return dueDateKey;
  if (normalized.length === 10) return `${normalized}T00:00`;
  return normalized;
}

/**
 * True when the due datetime is before now.
 * Legacy date-only keys use calendar-day comparison (due today is still on time).
 */
export function isPastDue(dueDateKey: string | undefined, now: Date = new Date()): boolean {
  if (!dueDateKey) return false;
  if (!dueDateKeyHasTime(dueDateKey)) {
    return dueDateKey < localDateKey(now);
  }
  const due = parseDueDateKey(dueDateKey);
  if (!due) return false;
  return due.getTime() < now.getTime();
}
