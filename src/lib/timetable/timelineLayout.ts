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

export type OverlapSlotInput = {
  id: string;
  startTime: string;
  endTime: string;
};

export type OverlapPlacement = {
  columnIndex: number;
  columnCount: number;
  leftPct: number;
  widthPct: number;
};

type Interval = {
  id: string;
  start: number;
  end: number;
};

function rangesOverlap(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

function clusterOverlapping(items: Array<Interval>): Array<Array<Interval>> {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const clusters: Array<Array<Interval>> = [];
  let current: Array<Interval> = [];
  let currentEnd = Number.NEGATIVE_INFINITY;

  for (const item of sorted) {
    if (current.length === 0 || item.start < currentEnd) {
      current.push(item);
      currentEnd = Math.max(currentEnd, item.end);
      continue;
    }
    clusters.push(current);
    current = [item];
    currentEnd = item.end;
  }
  if (current.length > 0) clusters.push(current);
  return clusters;
}

function assignColumns(cluster: Array<Interval>): Map<string, number> {
  const columns: Array<number> = [];
  const assignment = new Map<string, number>();
  const ordered = [...cluster].sort((a, b) => a.start - b.start || b.end - a.end);

  for (const item of ordered) {
    let columnIndex = columns.findIndex((end) => end <= item.start);
    if (columnIndex === -1) {
      columnIndex = columns.length;
      columns.push(item.end);
    } else {
      columns[columnIndex] = item.end;
    }
    assignment.set(item.id, columnIndex);
  }
  return assignment;
}

export function layoutOverlappingSlots(
  slots: Array<OverlapSlotInput>,
): Map<string, OverlapPlacement> {
  const intervals: Array<Interval> = slots.map((slot) => ({
    id: slot.id,
    start: timeToMinutes(slot.startTime),
    end: timeToMinutes(slot.endTime),
  }));
  const placements = new Map<string, OverlapPlacement>();

  for (const cluster of clusterOverlapping(intervals)) {
    const columns = assignColumns(cluster);
    const columnCount = Math.max(1, new Set(columns.values()).size);
    for (const item of cluster) {
      const columnIndex = columns.get(item.id) ?? 0;
      placements.set(item.id, {
        columnIndex,
        columnCount,
        leftPct: (columnIndex / columnCount) * 100,
        widthPct: 100 / columnCount,
      });
    }
  }

  return placements;
}

export function slotsOverlap(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string },
): boolean {
  return rangesOverlap(
    { id: "a", start: timeToMinutes(a.startTime), end: timeToMinutes(a.endTime) },
    { id: "b", start: timeToMinutes(b.startTime), end: timeToMinutes(b.endTime) },
  );
}
