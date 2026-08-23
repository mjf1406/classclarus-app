const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_HM_RE = /^\d{2}:\d{2}$/;

export function isValidDateKey(value: string): boolean {
  if (!DATE_KEY_RE.test(value)) return false;
  return parseDateKey(value) !== null;
}

export function isValidTimeHm(value: string): boolean {
  if (!TIME_HM_RE.test(value)) return false;
  const hour = Number(value.slice(0, 2));
  const minute = Number(value.slice(3, 5));
  return hour <= 23 && minute <= 59;
}

export function parseDateKey(dateKey: string): { year: number; month: number; day: number } | null {
  if (!DATE_KEY_RE.test(dateKey)) return null;
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(5, 7));
  const day = Number(dateKey.slice(8, 10));
  const utc = Date.UTC(year, month - 1, day);
  const parsed = new Date(utc);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

export function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const parsed = parseDateKey(dateKey);
  if (!parsed) {
    throw new Error("Invalid date");
  }
  const next = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days));
  return formatDateKey(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate());
}

export function compareDateKeys(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Inclusive start / exclusive end. */
export function dateKeyRangeOverlaps(
  startA: string,
  endExclusiveA: string,
  startB: string,
  endExclusiveB: string,
): boolean {
  return startA < endExclusiveB && endExclusiveA > startB;
}

export function inclusiveEndToExclusive(endInclusive: string): string {
  return addDaysToDateKey(endInclusive, 1);
}

export function exclusiveEndToInclusive(endExclusive: string): string {
  return addDaysToDateKey(endExclusive, -1);
}
