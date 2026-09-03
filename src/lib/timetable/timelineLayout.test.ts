import { describe, expect, test } from "vite-plus/test";

import { getSlotLayout, layoutOverlappingSlots } from "@/lib/timetable/timelineLayout";

describe("getSlotLayout", () => {
  test("places a slot by minutes from the day start", () => {
    const layout = getSlotLayout("09:00", "10:00", 8 * 60, 16 * 60, 2);
    expect(layout).toEqual({ topPx: 120, heightPx: 120 });
  });
});

describe("layoutOverlappingSlots", () => {
  test("gives full width to non-overlapping slots", () => {
    const placements = layoutOverlappingSlots([
      { id: "a", startTime: "09:00", endTime: "10:00" },
      { id: "b", startTime: "10:00", endTime: "11:00" },
    ]);
    expect(placements.get("a")).toMatchObject({ columnIndex: 0, columnCount: 1, widthPct: 100 });
    expect(placements.get("b")).toMatchObject({ columnIndex: 0, columnCount: 1, widthPct: 100 });
  });

  test("packs two overlapping slots into side-by-side columns", () => {
    const placements = layoutOverlappingSlots([
      { id: "a", startTime: "09:00", endTime: "10:00" },
      { id: "b", startTime: "09:30", endTime: "10:30" },
    ]);
    expect(placements.get("a")?.columnCount).toBe(2);
    expect(placements.get("b")?.columnCount).toBe(2);
    expect(placements.get("a")?.columnIndex).not.toBe(placements.get("b")?.columnIndex);
    expect(placements.get("a")?.widthPct).toBe(50);
  });

  test("reuses a column when a later slot no longer overlaps", () => {
    const placements = layoutOverlappingSlots([
      { id: "a", startTime: "09:00", endTime: "10:00" },
      { id: "b", startTime: "09:00", endTime: "09:30" },
      { id: "c", startTime: "10:00", endTime: "11:00" },
    ]);
    expect(placements.get("a")?.columnCount).toBe(2);
    expect(placements.get("b")?.columnCount).toBe(2);
    expect(placements.get("c")?.columnCount).toBe(1);
  });
});
