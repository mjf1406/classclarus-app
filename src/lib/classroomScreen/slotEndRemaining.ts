import { utcMsToZonedParts, zonedLocalToUtcMs } from "../../../convex/lib/calendar/timeZone";

/** Seconds until `endTime` today in `timeZone`. Returns 0 if that time has already passed. */
export function secondsUntilSlotEndToday(
  endTime: string,
  timeZone: string,
  nowMs = Date.now(),
): number {
  const timeHm = endTime.length >= 5 ? endTime.slice(0, 5) : endTime;
  const nowParts = utcMsToZonedParts(nowMs, timeZone);
  const targetMs = zonedLocalToUtcMs(nowParts.dateKey, timeHm, timeZone);
  return Math.max(0, Math.floor((targetMs - nowMs) / 1000));
}
