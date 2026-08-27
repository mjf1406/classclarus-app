import { describe, expect, test } from "vite-plus/test";

import {
  getSlotLayout,
  buildTimeLabels,
  pixelsPerMinuteForAvailableHeight,
} from "@/lib/timetable/timelineLayout";
import { PIXELS_PER_MINUTE } from "@/lib/timetable/timetable";

describe("getSlotLayout", () => {
  test("positions slot from day start with correct height", () => {
    const layout = getSlotLayout("09:00", "09:45", 8 * 60, 16 * 60);
    expect(layout).toEqual({
      topPx: 60 * PIXELS_PER_MINUTE,
      heightPx: 45 * PIXELS_PER_MINUTE,
    });
  });

  test("places an 08:40–10:00 slot between those times, not on the 08:30 row", () => {
    const layout = getSlotLayout("08:40", "10:00", 8 * 60, 16 * 60);
    expect(layout).toEqual({
      topPx: 40 * PIXELS_PER_MINUTE,
      heightPx: 80 * PIXELS_PER_MINUTE,
    });
  });

  test("returns null when slot is outside day bounds", () => {
    expect(getSlotLayout("07:00", "07:30", 8 * 60, 16 * 60)).toBeNull();
    expect(getSlotLayout("16:00", "16:30", 8 * 60, 16 * 60)).toBeNull();
  });

  test("enforces minimum slot height for short durations", () => {
    const layout = getSlotLayout("09:00", "09:05", 8 * 60, 16 * 60);
    expect(layout?.heightPx).toBeGreaterThanOrEqual(44);
  });
});

describe("buildTimeLabels", () => {
  test("generates labels at 30-minute intervals", () => {
    const labels = buildTimeLabels(8 * 60, 9 * 60, (m) => `${m}`, 30);
    expect(labels).toHaveLength(3);
    expect(labels[0]).toEqual({ topPx: 0, label: String(8 * 60) });
    expect(labels[1]).toEqual({ topPx: 30 * PIXELS_PER_MINUTE, label: String(8 * 60 + 30) });
  });

  test("scales label positions when pixels-per-minute changes", () => {
    const labels = buildTimeLabels(8 * 60, 9 * 60, (m) => `${m}`, 30, 1);
    expect(labels[1]).toEqual({ topPx: 30, label: String(8 * 60 + 30) });
  });
});

describe("pixelsPerMinuteForAvailableHeight", () => {
  test("shrinks to fill available height without going below the minimum", () => {
    expect(pixelsPerMinuteForAvailableHeight(480, 480)).toBe(1);
    expect(pixelsPerMinuteForAvailableHeight(480, 960)).toBe(2);
    expect(pixelsPerMinuteForAvailableHeight(480, 240)).toBe(1);
  });
});
