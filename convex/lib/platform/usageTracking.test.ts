import { describe, expect, test } from "vite-plus/test";

import {
  CI_CHECKOUTS_PER_ELECTRON_RELEASE,
  demoUsageStatsSummary,
  parseGithubOwnerRepo,
  periodBounds,
  utcDayKey,
  utcDayStartMs,
} from "./usageTracking";

describe("usageTracking helpers", () => {
  test("CI_CHECKOUTS_PER_ELECTRON_RELEASE matches electron-release checkouts", () => {
    expect(CI_CHECKOUTS_PER_ELECTRON_RELEASE).toBe(5);
  });

  test("parseGithubOwnerRepo", () => {
    expect(parseGithubOwnerRepo("https://github.com/mjf1406/vctr")).toEqual({
      owner: "mjf1406",
      repo: "vctr",
    });
    expect(parseGithubOwnerRepo("https://github.com/mjf1406/vctr.git")).toEqual({
      owner: "mjf1406",
      repo: "vctr",
    });
    expect(parseGithubOwnerRepo("https://example.com/x")).toBeNull();
  });

  test("utc day helpers", () => {
    const ms = Date.parse("2026-08-02T15:30:00.000Z");
    expect(utcDayKey(ms)).toBe("2026-08-02");
    expect(utcDayStartMs(ms)).toBe(Date.parse("2026-08-02T00:00:00.000Z"));
  });

  test("periodBounds today is from UTC midnight", () => {
    const now = Date.parse("2026-08-02T15:30:00.000Z");
    const bounds = periodBounds("today", now);
    expect(bounds?.lower?.key).toBe(Date.parse("2026-08-02T00:00:00.000Z"));
    expect(bounds?.upper?.key).toBe(now + 1);
  });

  test("periodBounds allTime is unbounded", () => {
    expect(periodBounds("allTime", Date.now())).toBeUndefined();
  });

  test("demoUsageStatsSummary is enabled with today chips", () => {
    const demo = demoUsageStatsSummary();
    expect(demo.enabled).toBe(true);
    expect(demo.downloadChip).toEqual({ count: 12, period: "today" });
    expect(demo.selfHostChip).toEqual({ count: 3, period: "today" });
    expect(demo.downloads.today).toBe(12);
    expect(demo.selfHostClicks.week).toBeGreaterThan(0);
    expect(demo.clones.week).toBeGreaterThan(0);
  });
});
