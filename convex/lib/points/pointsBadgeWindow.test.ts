import { describe, expect, test } from "vite-plus/test";

import { startOfZonedDayUtc } from "../calendar/timeZone";
import {
  aggregateMinusCountsByStudent,
  aggregateWarningCountsByStudent,
  daysInPointsBadgeWindow,
  isTimestampInPointsBadgeWindow,
  normalizePointsBadgeWeekStartDay,
  normalizePointsBadgeWindow,
  pointsBadgeLookbackForTimeZone,
  pointsBadgeLookbackWindow,
  resolvePointsBadgeWeekStartDay,
  resolvePointsBadgeWindow,
  startOfWeekDateKey,
} from "./pointsBadgeWindow";

describe("pointsBadgeWindow", () => {
  test("daysInPointsBadgeWindow maps units", () => {
    expect(daysInPointsBadgeWindow(1, "day")).toBe(1);
    expect(daysInPointsBadgeWindow(3, "day")).toBe(3);
    expect(daysInPointsBadgeWindow(2, "week")).toBe(14);
    expect(daysInPointsBadgeWindow(1, "month")).toBe(30);
  });

  test("resolvePointsBadgeWindow defaults invalid stored values", () => {
    expect(resolvePointsBadgeWindow(undefined, undefined)).toEqual({ amount: 1, unit: "day" });
    expect(resolvePointsBadgeWindow(5, "week")).toEqual({ amount: 5, unit: "week" });
    expect(resolvePointsBadgeWindow(0, "day")).toEqual({ amount: 1, unit: "day" });
  });

  test("normalizePointsBadgeWindow validates mutation input", () => {
    expect(normalizePointsBadgeWindow(5, "week")).toEqual({ amount: 5, unit: "week" });
    expect(() => normalizePointsBadgeWindow(0, "day")).toThrow(/at least/);
    expect(() => normalizePointsBadgeWindow(91, "day")).toThrow(/at most/);
  });

  test("resolvePointsBadgeWeekStartDay defaults to Monday", () => {
    expect(resolvePointsBadgeWeekStartDay(undefined)).toBe("monday");
    expect(resolvePointsBadgeWeekStartDay("saturday")).toBe("saturday");
    expect(resolvePointsBadgeWeekStartDay("notaday" as "monday")).toBe("monday");
  });

  test("normalizePointsBadgeWeekStartDay validates mutation input", () => {
    expect(normalizePointsBadgeWeekStartDay("sunday")).toBe("sunday");
    expect(() => normalizePointsBadgeWeekStartDay("notaday" as "monday")).toThrow(/weekday/);
  });

  test("startOfWeekDateKey snaps back to the configured weekday", () => {
    expect(startOfWeekDateKey("2026-08-09", "monday")).toBe("2026-08-03");
    expect(startOfWeekDateKey("2026-08-03", "monday")).toBe("2026-08-03");
    expect(startOfWeekDateKey("2026-08-09", "sunday")).toBe("2026-08-09");
    expect(startOfWeekDateKey("2026-08-09", "saturday")).toBe("2026-08-08");
    expect(startOfWeekDateKey("2026-08-05", "wednesday")).toBe("2026-08-05");
  });

  test("1 day lookback is the class-local dateKey day only", () => {
    const window = pointsBadgeLookbackWindow("2026-08-09", "Asia/Seoul", {
      amount: 1,
      unit: "day",
    });
    expect(window.startMs).toBe(Date.UTC(2026, 7, 8, 15, 0));
    expect(window.endMs).toBe(Date.UTC(2026, 7, 9, 15, 0));
  });

  test("3 day lookback includes prior local days", () => {
    const window = pointsBadgeLookbackWindow("2026-08-09", "UTC", { amount: 3, unit: "day" });
    expect(window.startMs).toBe(Date.UTC(2026, 7, 7, 0, 0));
    expect(window.endMs).toBe(Date.UTC(2026, 7, 10, 0, 0));
  });

  test("1 month lookback is 30 local days", () => {
    const window = pointsBadgeLookbackWindow("2026-08-09", "UTC", { amount: 1, unit: "month" });
    expect(window.startMs).toBe(Date.UTC(2026, 6, 11, 0, 0));
    expect(window.endMs).toBe(Date.UTC(2026, 7, 10, 0, 0));
  });

  test("1 week lookback on Sunday is the Monday-aligned week", () => {
    const window = pointsBadgeLookbackWindow("2026-08-09", "UTC", { amount: 1, unit: "week" });
    expect(window.startMs).toBe(Date.UTC(2026, 7, 3, 0, 0));
    expect(window.endMs).toBe(Date.UTC(2026, 7, 10, 0, 0));
  });

  test("1 week lookback on Wednesday starts Monday, not six days back", () => {
    const window = pointsBadgeLookbackWindow("2026-08-05", "UTC", { amount: 1, unit: "week" });
    expect(window.startMs).toBe(Date.UTC(2026, 7, 3, 0, 0));
    expect(window.endMs).toBe(Date.UTC(2026, 7, 6, 0, 0));
  });

  test("1 week lookback on the reset day is that day only", () => {
    const window = pointsBadgeLookbackWindow(
      "2026-08-03",
      "UTC",
      { amount: 1, unit: "week" },
      "monday",
    );
    expect(window.startMs).toBe(Date.UTC(2026, 7, 3, 0, 0));
    expect(window.endMs).toBe(Date.UTC(2026, 7, 4, 0, 0));
  });

  test("1 week lookback with Saturday start snaps to Saturday", () => {
    const window = pointsBadgeLookbackWindow(
      "2026-08-09",
      "UTC",
      { amount: 1, unit: "week" },
      "saturday",
    );
    expect(window.startMs).toBe(Date.UTC(2026, 7, 8, 0, 0));
    expect(window.endMs).toBe(Date.UTC(2026, 7, 10, 0, 0));
  });

  test("1 week lookback with Sunday start resets on Sunday", () => {
    const window = pointsBadgeLookbackWindow(
      "2026-08-09",
      "UTC",
      { amount: 1, unit: "week" },
      "sunday",
    );
    expect(window.startMs).toBe(Date.UTC(2026, 7, 9, 0, 0));
    expect(window.endMs).toBe(Date.UTC(2026, 7, 10, 0, 0));
  });

  test("2 week lookback includes the prior full aligned week", () => {
    const window = pointsBadgeLookbackWindow(
      "2026-08-05",
      "UTC",
      { amount: 2, unit: "week" },
      "monday",
    );
    expect(window.startMs).toBe(Date.UTC(2026, 6, 27, 0, 0));
    expect(window.endMs).toBe(Date.UTC(2026, 7, 6, 0, 0));
  });

  test("week boundaries include the reset instant and exclude the next midnight", () => {
    const window = pointsBadgeLookbackWindow(
      "2026-08-05",
      "UTC",
      { amount: 1, unit: "week" },
      "monday",
    );
    expect(isTimestampInPointsBadgeWindow(Date.UTC(2026, 7, 3, 0, 0), window)).toBe(true);
    expect(isTimestampInPointsBadgeWindow(Date.UTC(2026, 7, 2, 23, 59, 59, 999), window)).toBe(
      false,
    );
    expect(isTimestampInPointsBadgeWindow(Date.UTC(2026, 7, 5, 23, 59, 59, 999), window)).toBe(
      true,
    );
    expect(isTimestampInPointsBadgeWindow(Date.UTC(2026, 7, 6, 0, 0), window)).toBe(false);
  });

  test("week lookback uses class timezone midnights", () => {
    const window = pointsBadgeLookbackWindow(
      "2026-08-05",
      "Asia/Seoul",
      { amount: 1, unit: "week" },
      "monday",
    );
    expect(window.startMs).toBe(Date.UTC(2026, 7, 2, 15, 0));
    expect(window.endMs).toBe(Date.UTC(2026, 7, 5, 15, 0));
  });

  test("week lookback spans a DST change with zoned midnights", () => {
    const window = pointsBadgeLookbackWindow(
      "2026-03-11",
      "America/New_York",
      { amount: 2, unit: "week" },
      "monday",
    );
    expect(window.startMs).toBe(startOfZonedDayUtc("2026-03-02", "America/New_York"));
    expect(window.endMs).toBe(startOfZonedDayUtc("2026-03-12", "America/New_York"));
  });

  test("pointsBadgeLookbackForTimeZone uses the zoned calendar day", () => {
    const utcMs = Date.UTC(2026, 7, 8, 16, 0); // 2026-08-09 01:00 in UTC+9
    const window = pointsBadgeLookbackForTimeZone(utcMs, "Asia/Seoul", { amount: 1, unit: "day" });
    expect(window.startMs).toBe(Date.UTC(2026, 7, 8, 15, 0));
    expect(window.endMs).toBe(Date.UTC(2026, 7, 9, 15, 0));
  });

  test("pointsBadgeLookbackForTimeZone aligns weeks to the class start day", () => {
    const utcMs = Date.UTC(2026, 7, 5, 12, 0);
    const window = pointsBadgeLookbackForTimeZone(
      utcMs,
      "UTC",
      { amount: 1, unit: "week" },
      "monday",
    );
    expect(window.startMs).toBe(Date.UTC(2026, 7, 3, 0, 0));
    expect(window.endMs).toBe(Date.UTC(2026, 7, 6, 0, 0));
  });

  test("aggregateWarningCountsByStudent counts in window", () => {
    const window = pointsBadgeLookbackWindow("2026-08-09", "UTC", { amount: 1, unit: "day" });
    const counts = aggregateWarningCountsByStudent(
      [
        { studentUserId: "a", createdAt: Date.UTC(2026, 7, 9, 10, 0) },
        { studentUserId: "a", createdAt: Date.UTC(2026, 7, 9, 12, 0) },
        { studentUserId: "a", createdAt: Date.UTC(2026, 7, 8, 12, 0) },
        { studentUserId: "b", createdAt: Date.UTC(2026, 7, 9, 8, 0) },
      ],
      window,
    );
    expect(counts.get("a")).toBe(2);
    expect(counts.get("b")).toBe(1);
  });

  test("aggregateMinusCountsByStudent sums quantity on negative apps", () => {
    const window = pointsBadgeLookbackWindow("2026-08-09", "UTC", { amount: 1, unit: "day" });
    const counts = aggregateMinusCountsByStudent(
      [
        {
          studentUserId: "a",
          pointsApplied: -2,
          quantity: 2,
          awardedAt: Date.UTC(2026, 7, 9, 10, 0),
        },
        {
          studentUserId: "a",
          pointsApplied: -1,
          awardedAt: Date.UTC(2026, 7, 9, 11, 0),
        },
        {
          studentUserId: "a",
          pointsApplied: 3,
          quantity: 1,
          awardedAt: Date.UTC(2026, 7, 9, 12, 0),
        },
        {
          studentUserId: "b",
          pointsApplied: -5,
          quantity: 3,
          awardedAt: Date.UTC(2026, 7, 8, 12, 0),
        },
      ],
      window,
    );
    expect(counts.get("a")).toBe(3); // 2 + 1
    expect(counts.get("b")).toBeUndefined();
  });
});
