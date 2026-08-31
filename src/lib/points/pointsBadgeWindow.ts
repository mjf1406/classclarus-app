export type PointsBadgeWindowUnit = "day" | "week" | "month";

export type PointsBadgeWeekStartDay =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

export const POINTS_BADGE_WINDOW_UNITS: Array<PointsBadgeWindowUnit> = ["day", "week", "month"];

export const POINTS_BADGE_WEEK_START_DAYS: Array<PointsBadgeWeekStartDay> = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const MIN_POINTS_BADGE_WINDOW_AMOUNT = 1;
export const MAX_POINTS_BADGE_WINDOW_AMOUNT = 90;
export const DEFAULT_POINTS_BADGE_WEEK_START_DAY: PointsBadgeWeekStartDay = "monday";

export function isPointsBadgeWindowUnit(value: string): value is PointsBadgeWindowUnit {
  return (POINTS_BADGE_WINDOW_UNITS as Array<string>).includes(value);
}

export function isPointsBadgeWeekStartDay(value: string): value is PointsBadgeWeekStartDay {
  return (POINTS_BADGE_WEEK_START_DAYS as Array<string>).includes(value);
}
