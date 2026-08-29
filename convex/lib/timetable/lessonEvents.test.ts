import { describe, expect, test } from "vite-plus/test";

import { startOfZonedDayUtc } from "../calendar/timeZone";
import {
  eventMatchesSubjectAudience,
  lessonDateKeyFromSlot,
  selectUpcomingLessonEvents,
  type LessonEventSource,
} from "./lessonEvents";
import {
  dateKeyFromIsoWeek,
  getIsoWeekYearAndNumber,
  getIsoWeekYearAndNumberFromDateKey,
  weekdayNameFromDateKey,
} from "./timetableSchema";
import type { Id } from "../../_generated/dataModel";

function event(
  partial: Partial<LessonEventSource> & Pick<LessonEventSource, "title">,
): LessonEventSource {
  return {
    _id: (partial._id ?? `events:${partial.title}`) as Id<"calendarEvents">,
    title: partial.title,
    allDay: partial.allDay ?? true,
    startDateKey: partial.startDateKey,
    endDateKey: partial.endDateKey,
    startAt: partial.startAt,
    endAt: partial.endAt,
    audienceKind: partial.audienceKind ?? "all",
    audienceRoles: partial.audienceRoles ?? [],
  };
}

describe("lessonDateKeyFromSlot", () => {
  test("inverts ISO week helpers for a Thursday", () => {
    const dateKey = dateKeyFromIsoWeek(2026, 10, "Thursday");
    const parsed = getIsoWeekYearAndNumber(new Date(`${dateKey}T12:00:00Z`));
    expect(parsed).toEqual({ year: 2026, weekNumber: 10 });
    expect(lessonDateKeyFromSlot(2026, 10, "Thursday")).toBe(dateKey);
  });

  test("reads weekday and ISO week from a calendar date key", () => {
    expect(weekdayNameFromDateKey("2026-08-29")).toBe("Saturday");
    expect(getIsoWeekYearAndNumberFromDateKey("2026-08-29")).toEqual({
      year: 2026,
      weekNumber: 35,
    });
  });
});

describe("eventMatchesSubjectAudience", () => {
  test("always includes all-class events", () => {
    expect(
      eventMatchesSubjectAudience({ audienceKind: "all", audienceRoles: [] }, ["teacher"]),
    ).toBe(true);
  });

  test("requires an overlapping target role", () => {
    expect(
      eventMatchesSubjectAudience(
        { audienceKind: "roles", audienceRoles: ["guardian", "student"] },
        ["student"],
      ),
    ).toBe(true);
    expect(
      eventMatchesSubjectAudience({ audienceKind: "roles", audienceRoles: ["guardian"] }, [
        "student",
      ]),
    ).toBe(false);
  });
});

describe("selectUpcomingLessonEvents", () => {
  test("returns the next three events from the lesson date in the class timezone", () => {
    const tokyoLesson = "2026-03-02";
    const tokyoDayStart = startOfZonedDayUtc(tokyoLesson, "Asia/Tokyo");
    const selected = selectUpcomingLessonEvents(
      [
        event({
          title: "Past all-day",
          startDateKey: "2026-03-01",
          endDateKey: "2026-03-02",
        }),
        event({
          title: "Today assembly",
          startDateKey: "2026-03-02",
          endDateKey: "2026-03-03",
        }),
        event({
          title: "Teacher only",
          startDateKey: "2026-03-03",
          endDateKey: "2026-03-04",
          audienceKind: "roles",
          audienceRoles: ["teacher"],
        }),
        event({
          title: "Timed later",
          allDay: false,
          startAt: tokyoDayStart + 10 * 60 * 60 * 1000,
          endAt: tokyoDayStart + 11 * 60 * 60 * 1000,
        }),
        event({
          title: "Next week trip",
          startDateKey: "2026-03-09",
          endDateKey: "2026-03-10",
        }),
        event({
          title: "Too far",
          startDateKey: "2026-06-01",
          endDateKey: "2026-06-02",
        }),
      ],
      tokyoLesson,
      "Asia/Tokyo",
      ["student"],
    );

    expect(selected.map((item) => item.title)).toEqual([
      "Today assembly",
      "Next week trip",
      "Timed later",
    ]);
  });
});
