import { describe, expect, test } from "vite-plus/test";

import {
  aggregateMinusCountsByStudent,
  aggregateWarningCountsByStudent,
  daysInPointsBadgeWindow,
  normalizePointsBadgeWindow,
  pointsBadgeLookbackForTimeZone,
  pointsBadgeLookbackWindow,
  resolvePointsBadgeWindow,
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

  test("1 day lookback is local dateKey day only", () => {
    const offset = -540; // UTC+9
    const window = pointsBadgeLookbackWindow("2026-08-09", offset, { amount: 1, unit: "day" });
    // Local 2026-08-09 00:00 UTC+9 = 2026-08-08 15:00 UTC
    expect(window.startMs).toBe(Date.UTC(2026, 7, 8, 15, 0));
    expect(window.endMs).toBe(Date.UTC(2026, 7, 9, 15, 0));
  });

  test("3 day lookback includes prior local days", () => {
    const offset = 0;
    const window = pointsBadgeLookbackWindow("2026-08-09", offset, { amount: 3, unit: "day" });
    expect(window.startMs).toBe(Date.UTC(2026, 7, 7, 0, 0));
    expect(window.endMs).toBe(Date.UTC(2026, 7, 10, 0, 0));
  });

  test("1 week lookback is 7 local days", () => {
    const offset = 0;
    const window = pointsBadgeLookbackWindow("2026-08-09", offset, { amount: 1, unit: "week" });
    expect(window.startMs).toBe(Date.UTC(2026, 7, 3, 0, 0));
    expect(window.endMs).toBe(Date.UTC(2026, 7, 10, 0, 0));
  });

  test("pointsBadgeLookbackForTimeZone uses the zoned calendar day", () => {
    const utcMs = Date.UTC(2026, 7, 8, 16, 0); // 2026-08-09 01:00 in UTC+9
    const window = pointsBadgeLookbackForTimeZone(utcMs, "Asia/Seoul", { amount: 1, unit: "day" });
    expect(window.startMs).toBe(Date.UTC(2026, 7, 8, 15, 0));
    expect(window.endMs).toBe(Date.UTC(2026, 7, 9, 15, 0));
  });

  test("aggregateWarningCountsByStudent counts in window", () => {
    const window = pointsBadgeLookbackWindow("2026-08-09", 0, { amount: 1, unit: "day" });
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
    const window = pointsBadgeLookbackWindow("2026-08-09", 0, { amount: 1, unit: "day" });
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
