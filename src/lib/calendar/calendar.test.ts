import { describe, expect, test } from "vite-plus/test";

import { dayPickerLocaleForLanguage } from "@/lib/calendar/dayPickerLocale";
import {
  addMinutesToLocalDateTime,
  ceilToNextQuarterHour,
  dateKeyForYearMonth,
  defaultEventFormValues,
  defaultTimedRange,
  endDateTimeFromStart,
  formatDateKeyLocalized,
  formatTimeHm,
  localDateToDateKey,
} from "@/lib/calendar/calendar";

function localDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
  ms = 0,
): Date {
  return new Date(year, month - 1, day, hour, minute, second, ms);
}

describe("ceilToNextQuarterHour", () => {
  test("keeps an exact quarter hour", () => {
    const next = ceilToNextQuarterHour(localDate(2026, 8, 23, 10, 0, 0, 0));
    expect(formatTimeHm(next)).toBe("10:00");
    expect(localDateToDateKey(next)).toBe("2026-08-23");
  });

  test("ceils past an exact quarter hour", () => {
    expect(formatTimeHm(ceilToNextQuarterHour(localDate(2026, 8, 23, 10, 0, 0, 1)))).toBe("10:15");
    expect(formatTimeHm(ceilToNextQuarterHour(localDate(2026, 8, 23, 10, 1)))).toBe("10:15");
    expect(formatTimeHm(ceilToNextQuarterHour(localDate(2026, 8, 23, 10, 16)))).toBe("10:30");
    expect(formatTimeHm(ceilToNextQuarterHour(localDate(2026, 8, 23, 10, 45)))).toBe("10:45");
    expect(formatTimeHm(ceilToNextQuarterHour(localDate(2026, 8, 23, 10, 46)))).toBe("11:00");
  });

  test("rolls to the next day after 23:45", () => {
    const next = ceilToNextQuarterHour(localDate(2026, 8, 23, 23, 50));
    expect(formatTimeHm(next)).toBe("00:00");
    expect(localDateToDateKey(next)).toBe("2026-08-24");
  });
});

describe("addMinutesToLocalDateTime", () => {
  test("adds thirty minutes on the same day", () => {
    expect(addMinutesToLocalDateTime("2026-08-23", "10:15", 30)).toEqual({
      dateKey: "2026-08-23",
      timeHm: "10:45",
    });
  });

  test("crosses midnight", () => {
    expect(addMinutesToLocalDateTime("2026-08-23", "23:45", 30)).toEqual({
      dateKey: "2026-08-24",
      timeHm: "00:15",
    });
  });
});

describe("endDateTimeFromStart", () => {
  test("returns start plus thirty minutes", () => {
    expect(endDateTimeFromStart("2026-08-23", "14:00")).toEqual({
      endDateKey: "2026-08-23",
      endTime: "14:30",
    });
  });

  test("returns null for invalid input", () => {
    expect(endDateTimeFromStart("not-a-date", "14:00")).toBeNull();
    expect(endDateTimeFromStart("2026-08-23", "25:00")).toBeNull();
  });
});

describe("defaultTimedRange", () => {
  test("uses the next quarter hour and a 30-minute end on the selected day", () => {
    expect(defaultTimedRange("2026-08-23", localDate(2026, 8, 23, 10, 7))).toEqual({
      startDateKey: "2026-08-23",
      startTime: "10:15",
      endDateKey: "2026-08-23",
      endTime: "10:45",
    });
  });

  test("keeps a future selected date and only updates the time of day", () => {
    expect(defaultTimedRange("2026-08-25", localDate(2026, 8, 23, 10, 7))).toEqual({
      startDateKey: "2026-08-25",
      startTime: "10:15",
      endDateKey: "2026-08-25",
      endTime: "10:45",
    });
  });

  test("rolls today's date forward when the next quarter hour is tomorrow", () => {
    expect(defaultTimedRange("2026-08-23", localDate(2026, 8, 23, 23, 50))).toEqual({
      startDateKey: "2026-08-24",
      startTime: "00:00",
      endDateKey: "2026-08-24",
      endTime: "00:30",
    });
  });
});

describe("formatDateKeyLocalized", () => {
  test("returns invalid keys unchanged", () => {
    expect(formatDateKeyLocalized("not-a-date", "en-US")).toBe("not-a-date");
  });

  test("formats a date key with the given locale", () => {
    const en = formatDateKeyLocalized("2026-08-23", "en-US");
    const ja = formatDateKeyLocalized("2026-08-23", "ja");
    expect(en).toMatch(/2026/);
    expect(ja).toMatch(/2026/);
    expect(en).not.toBe(ja);
  });
});

describe("dayPickerLocaleForLanguage", () => {
  test("maps app languages to date-fns locale codes", () => {
    expect(dayPickerLocaleForLanguage("en").code).toBe("en-US");
    expect(dayPickerLocaleForLanguage("engb").code).toBe("en-GB");
    expect(dayPickerLocaleForLanguage("ja").code).toBe("ja");
    expect(dayPickerLocaleForLanguage("zhs").code).toBe("zh-CN");
    expect(dayPickerLocaleForLanguage("zht").code).toBe("zh-TW");
  });

  test("falls back to en-US for unknown languages", () => {
    expect(dayPickerLocaleForLanguage("xx").code).toBe("en-US");
  });
});

describe("dateKeyForYearMonth", () => {
  test("keeps the same day when the month has that date", () => {
    expect(dateKeyForYearMonth("2026-08-24", 2026, 9)).toBe("2026-09-24");
  });

  test("clamps to the last day of shorter months", () => {
    expect(dateKeyForYearMonth("2026-01-31", 2026, 2)).toBe("2026-02-28");
    expect(dateKeyForYearMonth("2024-01-31", 2024, 2)).toBe("2024-02-29");
  });
});

describe("defaultEventFormValues", () => {
  test("fills start and end from the user's current time", () => {
    const values = defaultEventFormValues("2026-08-23", false, localDate(2026, 8, 23, 9, 2));
    expect(values.startDateKey).toBe("2026-08-23");
    expect(values.startTime).toBe("09:15");
    expect(values.endDateKey).toBe("2026-08-23");
    expect(values.endTime).toBe("09:45");
    expect(values.allDay).toBe(false);
  });
});
