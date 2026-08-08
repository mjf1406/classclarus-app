import { beforeEach, describe, expect, test } from "vite-plus/test";

import i18n from "@/i18n";

import { formatDueRelative, formatLocalizedDueDate } from "./formatDate";

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
