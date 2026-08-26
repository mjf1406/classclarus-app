import { v } from "convex/values";

export const MIN_POINTS_BADGE_ALERT_COUNT = 1;
export const MAX_POINTS_BADGE_ALERT_COUNT = 99;
export const MAX_POINTS_BADGE_ALERT_ACTION_LENGTH = 80;
export const MAX_POINTS_BADGE_ALERTS = 10;

export const POINTS_BADGE_ALERT_EXAMPLE_COUNTS = [3, 5, 7] as const;

export type PointsBadgeAlertMetric = "warning" | "minus";

export type PointsBadgeAlert = {
  count: number;
  action: string;
};

export const pointsBadgeAlertItemValidator = v.object({
  count: v.number(),
  action: v.string(),
});

export const pointsBadgeAlertsValidator = v.array(pointsBadgeAlertItemValidator);

function sanitizeAction(value: string): string {
  return value
    .replace(/[\r\n\u2028\u2029]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidCount(value: number): boolean {
  return (
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= MIN_POINTS_BADGE_ALERT_COUNT &&
    value <= MAX_POINTS_BADGE_ALERT_COUNT
  );
}

/** Drop invalid stored rows; keep first action per count, sorted. */
export function resolvePointsBadgeAlerts(
  value: ReadonlyArray<{ count: number; action: string }> | undefined,
): PointsBadgeAlert[] {
  if (!value) return [];
  const alerts: PointsBadgeAlert[] = [];
  const seen = new Set<number>();
  for (const item of value) {
    if (!isValidCount(item.count)) continue;
    const action = sanitizeAction(item.action);
    if (action.length === 0 || action.length > MAX_POINTS_BADGE_ALERT_ACTION_LENGTH) continue;
    if (seen.has(item.count)) continue;
    seen.add(item.count);
    alerts.push({ count: item.count, action });
    if (alerts.length >= MAX_POINTS_BADGE_ALERTS) break;
  }
  return alerts.sort((a, b) => a.count - b.count);
}

/** Validate mutation input; throws on invalid alerts. */
export function normalizePointsBadgeAlerts(
  value: ReadonlyArray<{ count: number; action: string }>,
): PointsBadgeAlert[] {
  if (value.length > MAX_POINTS_BADGE_ALERTS) {
    throw new Error(`At most ${MAX_POINTS_BADGE_ALERTS} custom notifications are allowed`);
  }
  const alerts: PointsBadgeAlert[] = [];
  const seen = new Set<number>();
  for (const item of value) {
    if (!Number.isFinite(item.count) || !Number.isInteger(item.count)) {
      throw new Error("Notification count must be a whole number");
    }
    if (item.count < MIN_POINTS_BADGE_ALERT_COUNT) {
      throw new Error(`Notification count must be at least ${MIN_POINTS_BADGE_ALERT_COUNT}`);
    }
    if (item.count > MAX_POINTS_BADGE_ALERT_COUNT) {
      throw new Error(`Notification count must be at most ${MAX_POINTS_BADGE_ALERT_COUNT}`);
    }
    const action = sanitizeAction(item.action);
    if (action.length === 0) {
      throw new Error("Notification action is required");
    }
    if (action.length > MAX_POINTS_BADGE_ALERT_ACTION_LENGTH) {
      throw new Error(
        `Notification action must be at most ${MAX_POINTS_BADGE_ALERT_ACTION_LENGTH} characters`,
      );
    }
    if (seen.has(item.count)) {
      throw new Error("Each notification count must be unique");
    }
    seen.add(item.count);
    alerts.push({ count: item.count, action });
  }
  return alerts.sort((a, b) => a.count - b.count);
}

export function pointsBadgeAlertsEqual(
  left: ReadonlyArray<PointsBadgeAlert>,
  right: ReadonlyArray<PointsBadgeAlert>,
): boolean {
  if (left.length !== right.length) return false;
  return left.every(
    (item, index) => item.count === right[index]?.count && item.action === right[index]?.action,
  );
}

/** Alerts whose count was newly reached when moving from previousCount to newCount. */
export function crossedPointsBadgeAlerts(
  previousCount: number,
  newCount: number,
  alerts: ReadonlyArray<PointsBadgeAlert>,
): PointsBadgeAlert[] {
  const previous = Math.max(0, previousCount);
  const next = Math.max(0, newCount);
  if (next <= previous) return [];
  return alerts
    .filter((alert) => alert.count > previous && alert.count <= next)
    .sort((a, b) => a.count - b.count);
}

export function pointsBoardHref(classId: string): string {
  return `/class/${classId}/points`;
}

export function pointsBadgeAlertEnglishTitle(
  studentName: string,
  metric: PointsBadgeAlertMetric,
  count: number,
): string {
  if (metric === "warning") {
    return `${studentName} has ${count} warnings`;
  }
  return `${studentName} has ${count} minus marks`;
}
