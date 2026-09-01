import { addDaysToDateKey } from "../calendar/dateKey.js";
import { utcMsToZonedParts, zonedLocalToUtcMs } from "../calendar/timeZone.js";

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    if (remainingSeconds === 0) return `${minutes} min`;
    return `${minutes}m ${remainingSeconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

export function normalizeEndTime(endTime: string): string {
  const parts = endTime.split(":");
  if (parts.length === 2) return `${endTime}:00`;
  return endTime;
}

export function secondsUntilEndTime(endTime: string, timeZone: string, nowMs = Date.now()): number {
  const parts = normalizeEndTime(endTime).split(":").map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  const seconds = parts[2] ?? 0;
  const nowParts = utcMsToZonedParts(nowMs, timeZone);
  const timeHm = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  let targetMs = zonedLocalToUtcMs(nowParts.dateKey, timeHm, timeZone, seconds);

  if (targetMs <= nowMs) {
    targetMs = zonedLocalToUtcMs(addDaysToDateKey(nowParts.dateKey, 1), timeHm, timeZone, seconds);
  }

  return Math.floor((targetMs - nowMs) / 1000);
}

export function durationToSeconds(value: number, unit: "seconds" | "minutes" | "hours"): number {
  switch (unit) {
    case "minutes":
      return value * 60;
    case "hours":
      return value * 3600;
    default:
      return value;
  }
}
