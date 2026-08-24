import { describe, expect, test } from "vite-plus/test";

import { eventVisibleToRole } from "./audience";
import { inclusiveEndToExclusive, isValidDateKey, isValidTimeHm } from "./dateKey";
import { calendarEventHref } from "./eventHref";
import { eventOverlapsDateKey, eventOverlapsRange } from "./overlap";
import { computeNotifyAt, reminderOffsetMs } from "./reminders";
import {
  calendarEventFormSchemaEn,
  normalizeCalendarEventInput,
  type CalendarEventFormValues,
} from "./calendarEventSchema";
import {
  startOfZonedDayUtc,
  timezoneCityLabel,
  timezoneMatchesQuery,
  utcMsToZonedParts,
  zonedLocalToUtcMs,
} from "./timeZone";
import { buildMonthGrid, monthRangeUtc } from "./monthGrid";

describe("calendar date keys", () => {
  test("validates calendar dates and times", () => {
    expect(isValidDateKey("2026-02-28")).toBe(true);
    expect(isValidDateKey("2026-02-29")).toBe(false);
    expect(isValidTimeHm("09:00")).toBe(true);
    expect(isValidTimeHm("24:00")).toBe(false);
    expect(inclusiveEndToExclusive("2026-08-23")).toBe("2026-08-24");
  });
});

describe("calendar time zones", () => {
  test("converts class-local times through DST", () => {
    const start = zonedLocalToUtcMs("2026-03-08", "01:30", "America/New_York");
    const parts = utcMsToZonedParts(start, "America/New_York");
    expect(parts.dateKey).toBe("2026-03-08");
    expect(parts.timeHm).toBe("01:30");
    const afterSpring = zonedLocalToUtcMs("2026-03-08", "03:30", "America/New_York");
    expect(afterSpring - start).toBe(60 * 60 * 1000);
  });

  test("city search matches IANA ids with underscores", () => {
    expect(timezoneMatchesQuery("America/New_York", "new york")).toBe(true);
    expect(timezoneMatchesQuery("Asia/Tokyo", "tokyo")).toBe(true);
    expect(timezoneMatchesQuery("America/New_York", "london")).toBe(false);
    expect(timezoneCityLabel("America/New_York")).toBe("America/New York");
  });
});

describe("calendar overlap", () => {
  test("all-day exclusive ends do not include the following day", () => {
    const event = {
      allDay: true,
      startDateKey: "2026-08-23",
      endDateKey: "2026-08-25",
    };
    expect(eventOverlapsDateKey(event, "2026-08-23", "UTC")).toBe(true);
    expect(eventOverlapsDateKey(event, "2026-08-24", "UTC")).toBe(true);
    expect(eventOverlapsDateKey(event, "2026-08-25", "UTC")).toBe(false);
  });

  test("timed events overlap a UTC range", () => {
    const start = zonedLocalToUtcMs("2026-08-23", "09:00", "Asia/Tokyo");
    const end = zonedLocalToUtcMs("2026-08-23", "10:00", "Asia/Tokyo");
    const dayStart = startOfZonedDayUtc("2026-08-23", "Asia/Tokyo");
    const dayEnd = startOfZonedDayUtc("2026-08-24", "Asia/Tokyo");
    expect(
      eventOverlapsRange(
        { allDay: false, startAt: start, endAt: end },
        dayStart,
        dayEnd,
        "Asia/Tokyo",
      ),
    ).toBe(true);
  });
});

describe("calendar audience", () => {
  test("role targeting hides events from other roles", () => {
    expect(eventVisibleToRole("all", [], "student")).toBe(true);
    expect(eventVisibleToRole("roles", ["teacher"], "student")).toBe(false);
    expect(eventVisibleToRole("roles", ["teacher"], "teacher")).toBe(true);
  });
});

describe("calendar reminders", () => {
  test("computes offset before event start", () => {
    expect(reminderOffsetMs(2, "hour")).toBe(2 * 3_600_000);
    expect(computeNotifyAt(1_000_000, 10, "minute")).toBe(1_000_000 - 10 * 60_000);
  });
});

describe("calendar form schema", () => {
  test("normalizes inclusive all-day ends to exclusive keys", () => {
    const normalized = normalizeCalendarEventInput(
      {
        title: "Trip",
        description: "",
        allDay: true,
        startDateKey: "2026-08-23",
        startTime: "09:00",
        endDateKey: "2026-08-24",
        endTime: "10:00",
        audienceKind: "all",
        audienceRoles: [],
        reminders: [],
      },
      "Asia/Tokyo",
    );
    expect(normalized.startDateKey).toBe("2026-08-23");
    expect(normalized.endDateKey).toBe("2026-08-25");
  });

  test("flags an all-day end date that is before the start date", () => {
    const result = calendarEventFormSchemaEn.safeParse({
      ...validEventFormValues(),
      allDay: true,
      startDateKey: "2026-08-24",
      endDateKey: "2026-08-23",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path[0] === "endDateKey")).toBe(true);
  });

  test("flags a timed end that is not after start", () => {
    const result = calendarEventFormSchemaEn.safeParse({
      ...validEventFormValues(),
      allDay: false,
      startDateKey: "2026-08-23",
      startTime: "10:00",
      endDateKey: "2026-08-23",
      endTime: "10:00",
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path[0] === "endTime")).toBe(true);
  });
});

describe("calendar event href", () => {
  test("builds the class event detail path", () => {
    expect(calendarEventHref("class_1", "event_1")).toBe("/class/class_1/calendar/event/event_1");
  });
});

function validEventFormValues(): CalendarEventFormValues {
  return {
    title: "Practice",
    description: "",
    allDay: false,
    startDateKey: "2026-08-23",
    startTime: "09:00",
    endDateKey: "2026-08-23",
    endTime: "10:00",
    audienceKind: "all",
    audienceRoles: [],
    reminders: [],
  };
}

describe("month grid", () => {
  test("builds a 6-week Sunday-start grid", () => {
    const grid = buildMonthGrid(2026, 8);
    expect(grid).toHaveLength(42);
    expect(grid[0]?.dateKey <= "2026-08-01").toBe(true);
    const range = monthRangeUtc(2026, 8, "UTC");
    expect(range.rangeEndMs).toBeGreaterThan(range.rangeStartMs);
  });
});
