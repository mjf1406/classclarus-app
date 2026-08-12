import { v } from "convex/values";

import { ledgerQuantity } from "./pointsRoster.js";

export const pointsBadgeWindowUnitValidator = v.union(
  v.literal("day"),
  v.literal("week"),
  v.literal("month"),
);

export type PointsBadgeWindowUnit = "day" | "week" | "month";

export type PointsBadgeWindow = {
  amount: number;
  unit: PointsBadgeWindowUnit;
};

export type PointsBadgeLookback = {
  startMs: number;
  endMs: number;
};

const UNITS = new Set<string>(["day", "week", "month"]);
const MS_PER_DAY = 86_400_000;
export const MIN_POINTS_BADGE_WINDOW_AMOUNT = 1;
export const MAX_POINTS_BADGE_WINDOW_AMOUNT = 90;
export const DEFAULT_POINTS_BADGE_WINDOW: PointsBadgeWindow = { amount: 1, unit: "day" };

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  if (!DATE_KEY_RE.test(dateKey)) {
    throw new Error("Invalid date key");
  }
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(5, 7)) - 1;
  const day = Number(dateKey.slice(8, 10));
  return { year, month, day };
}

/** Local midnight of `dateKey` as UTC ms (`timeZoneOffsetMinutes` = `Date#getTimezoneOffset()`). */
function utcMsFromLocalDateKey(dateKey: string, timeZoneOffsetMinutes: number): number {
  const { year, month, day } = parseDateKey(dateKey);
  return Date.UTC(year, month, day) + timeZoneOffsetMinutes * 60_000;
}

/**
 * Lookback from local “today” (`dateKey`): `1 day` = that day only;
 * `3 days` = today + prior 2 local days; week/month multiply by 7/30.
 */
export function pointsBadgeLookbackWindow(
  dateKey: string,
  timeZoneOffsetMinutes: number,
  window: PointsBadgeWindow,
): PointsBadgeLookback {
  if (!Number.isFinite(timeZoneOffsetMinutes)) {
    throw new Error("Invalid timezone offset");
  }
  const days = daysInPointsBadgeWindow(window.amount, window.unit);
  const todayStartMs = utcMsFromLocalDateKey(dateKey, timeZoneOffsetMinutes);
  return {
    startMs: todayStartMs - (days - 1) * MS_PER_DAY,
    endMs: todayStartMs + MS_PER_DAY,
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
