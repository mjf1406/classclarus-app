export type PointsBadgeWindowUnit = "day" | "week" | "month";

export const POINTS_BADGE_WINDOW_UNITS: Array<PointsBadgeWindowUnit> = ["day", "week", "month"];

export const MIN_POINTS_BADGE_WINDOW_AMOUNT = 1;
export const MAX_POINTS_BADGE_WINDOW_AMOUNT = 90;

export function isPointsBadgeWindowUnit(value: string): value is PointsBadgeWindowUnit {
  return (POINTS_BADGE_WINDOW_UNITS as Array<string>).includes(value);
}
