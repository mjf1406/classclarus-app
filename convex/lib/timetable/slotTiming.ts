import { compareDateKeys } from "../calendar/dateKey.js";
import { utcMsToZonedParts } from "../calendar/timeZone.js";
import { dateKeyFromIsoWeek, timeToMinutes, type WeekdayName } from "./timetableSchema.js";

export function isSlotElapsed(args: {
  day: WeekdayName;
  endTime: string;
  year: number;
  weekNumber: number;
  nowMs: number;
  timeZone: string;
}): boolean {
  const slotDateKey = dateKeyFromIsoWeek(args.year, args.weekNumber, args.day);
  const parts = utcMsToZonedParts(args.nowMs, args.timeZone);
  const dateCompare = compareDateKeys(slotDateKey, parts.dateKey);
  if (dateCompare < 0) return true;
  if (dateCompare > 0) return false;
  return timeToMinutes(args.endTime) <= parts.hour * 60 + parts.minute;
}
