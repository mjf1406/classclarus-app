import { v } from "convex/values";

import { addDaysToDateKey, parseDateKey } from "../calendar/dateKey.js";
import { isValidTimeZone, startOfZonedDayUtc, utcMsToZonedParts } from "../calendar/timeZone.js";
import { ledgerQuantity } from "./pointsRoster.js";

export const pointsBadgeWindowUnitValidator = v.union(
  v.literal("day"),
  v.literal("week"),
  v.literal("month"),
);

export const pointsBadgeWeekStartDayValidator = v.union(
  v.literal("sunday"),
  v.literal("monday"),
  v.literal("tuesday"),
  v.literal("wednesday"),
  v.literal("thursday"),
  v.literal("friday"),
  v.literal("saturday"),
);

export type PointsBadgeWindowUnit = "day" | "week" | "month";

export type PointsBadgeWeekStartDay =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export type PointsBadgeWindow = {
  amount: number;
  unit: PointsBadgeWindowUnit;
};

export type PointsBadgeLookback = {
  startMs: number;
  endMs: number;
};

const UNITS = new Set<string>(["day", "week", "month"]);
export const POINTS_BADGE_WEEK_START_DAYS: Array<PointsBadgeWeekStartDay> = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const WEEK_START_DAYS = new Set<string>(POINTS_BADGE_WEEK_START_DAYS);
const WEEKDAY_INDEX: Record<PointsBadgeWeekStartDay, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export const MIN_POINTS_BADGE_WINDOW_AMOUNT = 1;
export const MAX_POINTS_BADGE_WINDOW_AMOUNT = 90;
export const DEFAULT_POINTS_BADGE_WINDOW: PointsBadgeWindow = { amount: 1, unit: "day" };
export const DEFAULT_POINTS_BADGE_WEEK_START_DAY: PointsBadgeWeekStartDay = "monday";

export function daysInPointsBadgeWindow(amount: number, unit: PointsBadgeWindowUnit): number {
  if (unit === "week") return amount * 7;
  if (unit === "month") return amount * 30;
  return amount;
}

/** Resolve stored/optional fields; invalid values fall back to defaults. */
export function resolvePointsBadgeWindow(
  amount: number | undefined,
  unit: PointsBadgeWindowUnit | undefined,
): PointsBadgeWindow {
  const resolvedUnit =
    unit !== undefined && UNITS.has(unit) ? unit : DEFAULT_POINTS_BADGE_WINDOW.unit;
  const resolvedAmount =
    amount !== undefined &&
    Number.isFinite(amount) &&
    Number.isInteger(amount) &&
    amount >= MIN_POINTS_BADGE_WINDOW_AMOUNT &&
    amount <= MAX_POINTS_BADGE_WINDOW_AMOUNT
      ? amount
      : DEFAULT_POINTS_BADGE_WINDOW.amount;
  return { amount: resolvedAmount, unit: resolvedUnit as PointsBadgeWindowUnit };
}

/** Resolve stored/optional week-start day; invalid values fall back to Monday. */
export function resolvePointsBadgeWeekStartDay(
  day: PointsBadgeWeekStartDay | undefined,
): PointsBadgeWeekStartDay {
  if (day !== undefined && WEEK_START_DAYS.has(day)) {
    return day;
  }
  return DEFAULT_POINTS_BADGE_WEEK_START_DAY;
}

/** Validate mutation input; throws on invalid amount/unit. */
export function normalizePointsBadgeWindow(
  amount: number,
  unit: PointsBadgeWindowUnit,
): PointsBadgeWindow {
  if (!UNITS.has(unit)) {
    throw new Error("Window unit must be day, week, or month");
  }
  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    throw new Error("Window amount must be a whole number");
  }
  if (amount < MIN_POINTS_BADGE_WINDOW_AMOUNT) {
    throw new Error(`Window amount must be at least ${MIN_POINTS_BADGE_WINDOW_AMOUNT}`);
  }
  if (amount > MAX_POINTS_BADGE_WINDOW_AMOUNT) {
    throw new Error(`Window amount must be at most ${MAX_POINTS_BADGE_WINDOW_AMOUNT}`);
  }
  return { amount, unit };
}

/** Validate mutation input; throws on invalid weekday. */
export function normalizePointsBadgeWeekStartDay(
  day: PointsBadgeWeekStartDay,
): PointsBadgeWeekStartDay {
  if (!WEEK_START_DAYS.has(day)) {
    throw new Error("Week start day must be a weekday");
  }
  return day;
}

function weekdayIndexFromDateKey(dateKey: string): number {
  const parsed = parseDateKey(dateKey);
  if (!parsed) {
    throw new Error("Invalid date key");
  }
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay();
}

export function startOfWeekDateKey(dateKey: string, weekStartDay: PointsBadgeWeekStartDay): string {
  const current = weekdayIndexFromDateKey(dateKey);
  const start = WEEKDAY_INDEX[weekStartDay];
  const daysBack = (current - start + 7) % 7;
  return addDaysToDateKey(dateKey, -daysBack);
}

/** Lookback ending on the zoned calendar day that contains `utcMs`. */
export function pointsBadgeLookbackForTimeZone(
  utcMs: number,
  timeZone: string | undefined,
  window: PointsBadgeWindow,
  weekStartDay?: PointsBadgeWeekStartDay,
): PointsBadgeLookback {
  const zone = timeZone && isValidTimeZone(timeZone) ? timeZone : "UTC";
  const { dateKey } = utcMsToZonedParts(utcMs, zone);
  return pointsBadgeLookbackWindow(dateKey, zone, window, weekStartDay);
}

/**
 * Lookback from class-local “today” (`dateKey`): `1 day` = that day only;
 * `3 days` = today + prior 2 local days; `month` multiplies by 30.
 * `week` aligns to `weekStartDay` (default Monday): current partial week
 * plus `amount - 1` prior full weeks, through the end of `dateKey`.
 */
export function pointsBadgeLookbackWindow(
  dateKey: string,
  timeZone: string | undefined,
  window: PointsBadgeWindow,
  weekStartDay?: PointsBadgeWeekStartDay,
): PointsBadgeLookback {
  if (!parseDateKey(dateKey)) {
    throw new Error("Invalid date key");
  }
  const zone = timeZone && isValidTimeZone(timeZone) ? timeZone : "UTC";
  const resolvedWeekStart = resolvePointsBadgeWeekStartDay(weekStartDay);

  let startDateKey: string;
  if (window.unit === "week") {
    const currentWeekStart = startOfWeekDateKey(dateKey, resolvedWeekStart);
    startDateKey = addDaysToDateKey(currentWeekStart, -7 * (window.amount - 1));
  } else {
    const days = daysInPointsBadgeWindow(window.amount, window.unit);
    startDateKey = addDaysToDateKey(dateKey, -(days - 1));
  }

  return {
    startMs: startOfZonedDayUtc(startDateKey, zone),
    endMs: startOfZonedDayUtc(addDaysToDateKey(dateKey, 1), zone),
  };
}

export function isTimestampInPointsBadgeWindow(
  timestamp: number,
  window: PointsBadgeLookback,
): boolean {
  return timestamp >= window.startMs && timestamp < window.endMs;
}

export function aggregateWarningCountsByStudent<TStudentId extends string>(
  events: ReadonlyArray<{ studentUserId: TStudentId; createdAt: number }>,
  window: PointsBadgeLookback,
): Map<TStudentId, number> {
  const counts = new Map<TStudentId, number>();
  for (const event of events) {
    if (!isTimestampInPointsBadgeWindow(event.createdAt, window)) continue;
    counts.set(event.studentUserId, (counts.get(event.studentUserId) ?? 0) + 1);
  }
  return counts;
}

/** Sum of `quantity` on negative behavior applications inside the window. */
export function aggregateMinusCountsByStudent<TStudentId extends string>(
  applications: ReadonlyArray<{
    studentUserId: TStudentId;
    pointsApplied: number;
    quantity?: number;
    awardedAt: number;
  }>,
  window: PointsBadgeLookback,
): Map<TStudentId, number> {
  const counts = new Map<TStudentId, number>();
  for (const app of applications) {
    if (app.pointsApplied >= 0) continue;
    if (!isTimestampInPointsBadgeWindow(app.awardedAt, window)) continue;
    const qty = ledgerQuantity(app.quantity);
    counts.set(app.studentUserId, (counts.get(app.studentUserId) ?? 0) + qty);
  }
  return counts;
}
