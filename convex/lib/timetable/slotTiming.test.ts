import { describe, expect, test } from "vite-plus/test";

import { isSlotElapsed } from "./slotTiming";

describe("isSlotElapsed", () => {
  test("marks a previous calendar day as elapsed", () => {
    expect(
      isSlotElapsed({
        day: "Monday",
        endTime: "16:00",
        year: 2026,
        weekNumber: 9,
        nowMs: Date.parse("2026-03-03T01:00:00.000Z"),
        timeZone: "UTC",
      }),
    ).toBe(true);
  });

  test("keeps a later calendar day usable", () => {
    expect(
      isSlotElapsed({
        day: "Wednesday",
        endTime: "09:00",
        year: 2026,
        weekNumber: 9,
        nowMs: Date.parse("2026-02-23T12:00:00.000Z"),
        timeZone: "UTC",
      }),
    ).toBe(false);
  });

  test("uses the slot end time on the same day", () => {
    const nowMs = Date.parse("2026-02-23T10:00:00.000Z");
    expect(
      isSlotElapsed({
        day: "Monday",
        endTime: "10:00",
        year: 2026,
        weekNumber: 9,
        nowMs,
        timeZone: "UTC",
      }),
    ).toBe(true);
    expect(
      isSlotElapsed({
        day: "Monday",
        endTime: "10:01",
        year: 2026,
        weekNumber: 9,
        nowMs,
        timeZone: "UTC",
      }),
    ).toBe(false);
  });

  test("uses the class timezone instead of UTC", () => {
    const utcMorning = Date.parse("2026-08-29T09:03:00.000Z");
    expect(
      isSlotElapsed({
        day: "Saturday",
        endTime: "16:00",
        year: 2026,
        weekNumber: 35,
        nowMs: utcMorning,
        timeZone: "Asia/Seoul",
      }),
    ).toBe(true);
    expect(
      isSlotElapsed({
        day: "Saturday",
        endTime: "16:00",
        year: 2026,
        weekNumber: 35,
        nowMs: utcMorning,
        timeZone: "UTC",
      }),
    ).toBe(false);
  });
});
