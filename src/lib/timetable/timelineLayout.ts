import {
  MIN_PIXELS_PER_MINUTE,
  PIXELS_PER_MINUTE,
  SLOT_MIN_HEIGHT_REM,
} from "@/lib/timetable/timetable";
import { timeToMinutes } from "@/lib/timetable/utils";

export const SLOT_MIN_HEIGHT_PX = SLOT_MIN_HEIGHT_REM * 16;

export type SlotLayout = {
  topPx: number;
  heightPx: number;
};

export function pixelsPerMinuteForAvailableHeight(
  dayDurationMinutes: number,
  availableHeightPx: number,
  minPixelsPerMinute: number = MIN_PIXELS_PER_MINUTE,
): number {
  if (dayDurationMinutes <= 0) return PIXELS_PER_MINUTE;
  if (availableHeightPx <= 0) return PIXELS_PER_MINUTE;
  return Math.max(minPixelsPerMinute, availableHeightPx / dayDurationMinutes);
}

export function getSlotLayout(
  startTime: string,
  endTime: string,
  dayStartMinutes: number,
  dayEndMinutes: number,
  pixelsPerMinute: number = PIXELS_PER_MINUTE,
): SlotLayout | null {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (end <= dayStartMinutes || start >= dayEndMinutes) return null;

  const topPx = (start - dayStartMinutes) * pixelsPerMinute;
  const durationMinutes = Math.max(end - start, 1);
  const heightPx = Math.max(durationMinutes * pixelsPerMinute, SLOT_MIN_HEIGHT_PX);

  return { topPx, heightPx };
}

export function buildTimeLabels(
  dayStartMinutes: number,
  dayEndMinutes: number,
  formatLabel: (minutes: number) => string,
  intervalMinutes = 30,
  pixelsPerMinute: number = PIXELS_PER_MINUTE,
): Array<{ topPx: number; label: string }> {
  const labels: Array<{ topPx: number; label: string }> = [];
  for (let m = dayStartMinutes; m <= dayEndMinutes; m += intervalMinutes) {
    labels.push({
      topPx: (m - dayStartMinutes) * pixelsPerMinute,
      label: formatLabel(m),
    });
  }
  return labels;
}

export function minutesToHm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
