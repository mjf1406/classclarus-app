import { beforeEach, describe, expect, test } from "vite-plus/test";

import i18n from "@/i18n";

import {
  formatDueRelative,
  formatLocalizedDueDate,
  formatLocalizedSeatChartHistoryDate,
  formatLocalizedTimeHm,
  formatLocalizedTimeRange,
} from "./formatDate";

describe("formatDueRelative", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  test("date-only: calendar days ahead and overdue", () => {
    const now = new Date(2026, 7, 8, 15, 0);
    expect(formatDueRelative("2026-08-08", now)).toBeNull();
    expect(formatDueRelative("2026-08-30", now)).toBe("22 days");
    expect(formatDueRelative("2026-08-05", now)).toBe("3 days ago");
  });

  test("datetime: minutes, hours, days, and overdue", () => {
    const now = new Date(2026, 7, 8, 15, 0);
    expect(formatDueRelative("2026-08-08T15:30", now)).toBe("30 minutes");
    expect(formatDueRelative("2026-08-09T03:00", now)).toBe("12 hours");
    expect(formatDueRelative("2026-08-30T20:20", now)).toBe("22 days");
    expect(formatDueRelative("2026-08-08T03:00", now)).toBe("12 hours ago");
  });

  test("datetime: omits under one minute", () => {
    const now = new Date(2026, 7, 8, 15, 0, 0);
    expect(formatDueRelative("2026-08-08T15:00", now)).toBeNull();
  });
});

describe("formatLocalizedDueDate", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  test("appends relative duration in parentheses", () => {
    const now = new Date(2026, 7, 8, 15, 0);
    const formatted = formatLocalizedDueDate("2026-08-30T20:20", now);
    expect(formatted).toContain("(22 days)");
    expect(formatted.startsWith("Sunday, August 30, 2026")).toBe(true);
  });
});

describe("formatLocalizedSeatChartHistoryDate", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  test("formats weekday, date, and time with the active locale", () => {
    const ts = new Date(2026, 7, 10, 16, 18, 0).getTime();
    const formatted = formatLocalizedSeatChartHistoryDate(ts);
    expect(formatted).toMatch(/Aug/);
    expect(formatted).toMatch(/10/);
    expect(formatted).toMatch(/2026/);
    expect(formatted).toMatch(/4:18/);
  });

  test("uses locale-specific date order", async () => {
    await i18n.changeLanguage("ja");
    const ts = new Date(2026, 7, 10, 16, 18, 0).getTime();
    const formatted = formatLocalizedSeatChartHistoryDate(ts);
    expect(formatted).toMatch(/2026年/);
    expect(formatted).toMatch(/8月/);
  });
});

describe("formatLocalizedTimeHm", () => {
  test("uses localized 12-hour markers", () => {
    expect(formatLocalizedTimeHm("16:30", "12", "en-US")).toMatch(/4:30/);
    expect(formatLocalizedTimeHm("16:30", "12", "en-US")).toMatch(/PM/i);
    expect(formatLocalizedTimeHm("16:30", "12", "ja")).not.toMatch(/PM/i);
  });

  test("keeps 24-hour clock numeric", () => {
    expect(formatLocalizedTimeHm("16:30", "24", "en-US")).toMatch(/16:30/);
  });
});

describe("formatLocalizedTimeRange", () => {
  test("formats a start and end time together", () => {
    const range = formatLocalizedTimeRange("09:00", "09:50", "12", "en-US");
    expect(range).toMatch(/9:00/);
    expect(range).toMatch(/9:50/);
  });
});
