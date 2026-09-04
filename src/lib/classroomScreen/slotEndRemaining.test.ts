import { describe, expect, test } from "vite-plus/test";

import { secondsUntilSlotEndToday } from "@/lib/classroomScreen/slotEndRemaining";

describe("secondsUntilSlotEndToday", () => {
  // 2026-09-04 16:00 EDT (UTC-4)
  const nowMs = Date.UTC(2026, 8, 4, 20, 0, 0);

  test("returns remaining seconds before the slot ends today", () => {
    expect(secondsUntilSlotEndToday("17:00", "America/New_York", nowMs)).toBe(3600);
  });

  test("returns 0 after the slot has ended today", () => {
    expect(secondsUntilSlotEndToday("15:00", "America/New_York", nowMs)).toBe(0);
  });
});
