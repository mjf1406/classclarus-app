import { describe, expect, test } from "vite-plus/test";

import {
  localYmdFromUtcMs,
  purchaseLimitWindow,
  startOfIsoWeek,
} from "../../../convex/lib/purchaseLimit";

describe("purchaseLimitWindow", () => {
  test("localYmdFromUtcMs uses timezone offset", () => {
    // 2026-08-08 00:30 UTC → still 8 Aug in UTC+0; 7 Aug in UTC-9 (offset +540)
    const ms = Date.UTC(2026, 7, 8, 0, 30);
    expect(localYmdFromUtcMs(ms, 0)).toEqual({ year: 2026, month: 7, day: 8 });
    expect(localYmdFromUtcMs(ms, 540)).toEqual({ year: 2026, month: 7, day: 7 });
  });

  test("startOfIsoWeek is Monday", () => {
    // Saturday 8 Aug 2026 → Monday 3 Aug
    expect(startOfIsoWeek({ year: 2026, month: 7, day: 8 })).toEqual({
      year: 2026,
      month: 7,
      day: 3,
    });
  });

  test("day every 1 is local calendar day", () => {
    const offset = -540; // UTC+9
    const now = Date.UTC(2026, 7, 7, 15, 0); // 2026-08-08 00:00 in UTC+9
    const window = purchaseLimitWindow(now, { period: "day", every: 1 }, offset);
    expect(window.startMs).toBe(Date.UTC(2026, 7, 7, 15, 0));
    expect(window.endMs).toBe(Date.UTC(2026, 7, 8, 15, 0));
  });

  test("week every 1 is ISO week Monday→Monday", () => {
    const offset = 0;
    const now = Date.UTC(2026, 7, 8, 12, 0); // Sat
    const window = purchaseLimitWindow(now, { period: "week", every: 1 }, offset);
    expect(window.startMs).toBe(Date.UTC(2026, 7, 3, 0, 0));
    expect(window.endMs).toBe(Date.UTC(2026, 7, 10, 0, 0));
  });

  test("month every 1 is calendar month", () => {
    const offset = 0;
    const now = Date.UTC(2026, 7, 8, 12, 0);
    const window = purchaseLimitWindow(now, { period: "month", every: 1 }, offset);
    expect(window.startMs).toBe(Date.UTC(2026, 7, 1, 0, 0));
    expect(window.endMs).toBe(Date.UTC(2026, 8, 1, 0, 0));
  });
});
