/** Local due date (`YYYY-MM-DD`) or datetime (`YYYY-MM-DDTHH:mm`, optional seconds). */
const DUE_DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;

function isValidCalendarParts(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Validates optional due date/datetime keys used by tasks and assignments. */
export function normalizeOptionalDueDateKey(dueDateKey: string | undefined): string | undefined {
  if (dueDateKey === undefined) return undefined;
  const trimmed = dueDateKey.trim();
  if (!trimmed) return undefined;
  if (!DUE_DATE_KEY_RE.test(trimmed)) {
    throw new Error("Invalid due date");
  }

  const year = Number(trimmed.slice(0, 4));
  const month = Number(trimmed.slice(5, 7));
  const day = Number(trimmed.slice(8, 10));
  if (!isValidCalendarParts(year, month, day)) {
    throw new Error("Invalid due date");
  }

  if (trimmed.length === 10) return trimmed;

  const hour = Number(trimmed.slice(11, 13));
  const minute = Number(trimmed.slice(14, 16));
  if (hour > 23 || minute > 59) {
    throw new Error("Invalid due date");
  }
  if (trimmed.length >= 19) {
    const second = Number(trimmed.slice(17, 19));
    if (second > 59) {
      throw new Error("Invalid due date");
    }
  }

  // Persist minute precision to match datetime-local without seconds.
  return trimmed.slice(0, 16);
}
