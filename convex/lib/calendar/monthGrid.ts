import { addDaysToDateKey, formatDateKey, parseDateKey } from "./dateKey.js";
import { startOfZonedDayUtc, utcMsToZonedParts } from "./timeZone.js";

export type MonthCell = {
  dateKey: string;
  inMonth: boolean;
};

/** Sunday-start month grid (6 weeks) in calendar-date space. */
export function buildMonthGrid(year: number, month: number): Array<MonthCell> {
  const firstKey = formatDateKey(year, month, 1);
  const firstUtc = Date.UTC(year, month - 1, 1);
  const weekday = new Date(firstUtc).getUTCDay();
  const gridStart = addDaysToDateKey(firstKey, -weekday);
  const cells: Array<MonthCell> = [];
  for (let i = 0; i < 42; i += 1) {
    const dateKey = addDaysToDateKey(gridStart, i);
    const cell = parseDateKey(dateKey);
    cells.push({
      dateKey,
      inMonth: cell?.year === year && cell?.month === month,
    });
  }
  return cells;
}

export function shiftYearMonth(
  year: number,
  month: number,
  deltaMonths: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + deltaMonths;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return { year: nextYear, month: nextMonth };
}

export function monthRangeUtc(
  year: number,
  month: number,
  timeZone: string,
): { rangeStartMs: number; rangeEndMs: number } {
  const grid = buildMonthGrid(year, month);
  const first = grid[0];
  const last = grid[grid.length - 1];
  if (!first || !last) {
    throw new Error("Invalid month grid");
  }
  const rangeStartMs = startOfZonedDayUtc(first.dateKey, timeZone);
  const rangeEndMs = startOfZonedDayUtc(addDaysToDateKey(last.dateKey, 1), timeZone);
  return { rangeStartMs, rangeEndMs };
}

export function classNowDateKey(nowMs: number, timeZone: string): string {
  return utcMsToZonedParts(nowMs, timeZone).dateKey;
}

export function dateKeyYearMonth(dateKey: string): { year: number; month: number } {
  const parsed = parseDateKey(dateKey);
  if (!parsed) {
    throw new Error("Invalid date");
  }
  return { year: parsed.year, month: parsed.month };
}
