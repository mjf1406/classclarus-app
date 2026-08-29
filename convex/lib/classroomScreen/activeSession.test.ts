import { describe, expect, test } from "vitest";

import {
  advanceSegment,
  buildCustomTimerSession,
  buildQuickPresetSession,
  buildTimerChainSegments,
  hasUpcomingSegments,
  parseSessionJson,
  remainingFromDisplaySession,
  truncateUpcomingSegments,
  type TimerDoc,
} from "./activeSession.js";
import { secondsUntilEndTime } from "./timerUtils.js";
import { getIsoWeekYearAndNumber } from "../timetable/timetableSchema.js";
import { findCurrentSlot, resolveCurrentLesson } from "./currentLesson.js";

describe("activeSession", () => {
  test("hasUpcomingSegments and truncateUpcomingSegments", () => {
    const session = buildQuickPresetSession(60, "#000");
    expect(hasUpcomingSegments(session)).toBe(false);
    const multi = {
      ...session,
      segments: [...session.segments, ...session.segments],
      index: 0,
    };
    expect(hasUpcomingSegments(multi)).toBe(true);
    expect(truncateUpcomingSegments(multi).segments).toHaveLength(1);
  });

  test("advanceSegment returns null on last segment", () => {
    const session = buildQuickPresetSession(30, "#000");
    expect(advanceSegment(session)).toBeNull();
  });

  test("buildTimerChainSegments prevents cycles", () => {
    const timers: TimerDoc[] = [
      { _id: "a", name: "A", durationSeconds: 10, bgColor: "#111", nextTimerId: "b" },
      { _id: "b", name: "B", durationSeconds: 20, bgColor: "#222", nextTimerId: "a" },
    ];
    const segments = buildTimerChainSegments(timers[0]!, timers);
    expect(segments).toHaveLength(2);
  });

  test("buildCustomTimerSession uses chain when provided", () => {
    const timers: TimerDoc[] = [
      { _id: "a", name: "A", durationSeconds: 10, bgColor: "#111", nextTimerId: "b" },
      { _id: "b", name: "B", durationSeconds: 20, bgColor: "#222" },
    ];
    const session = buildCustomTimerSession(timers[0]!, undefined, timers);
    expect(session.segments).toHaveLength(2);
  });

  test("parseSessionJson rejects invalid payloads", () => {
    expect(parseSessionJson(null)).toBeNull();
    expect(parseSessionJson({ index: 0 })).toBeNull();
  });

  test("remainingFromDisplaySession respects pause", () => {
    expect(remainingFromDisplaySession(Date.now() + 5000, false, undefined, Date.now())).toBe(5);
    expect(remainingFromDisplaySession(null, true, 4500, Date.now())).toBe(4);
  });
});

describe("timerUtils", () => {
  test("secondsUntilEndTime rolls to next day when needed", () => {
    const noon = new Date("2026-01-15T12:00:00");
    const seconds = secondsUntilEndTime("11:00:00", noon.getTime());
    expect(seconds).toBeGreaterThan(20 * 60 * 60);
  });
});

describe("currentLesson", () => {
  test("findCurrentSlot prefers active slot over early preview", () => {
    const slots = [
      { _id: "1", day: "Thursday", startTime: "09:00", endTime: "09:30" },
      { _id: "2", day: "Thursday", startTime: "09:31", endTime: "10:00" },
    ];
    const thursday930 = new Date("2026-01-15T09:35:00");
    expect(findCurrentSlot(slots, thursday930)?._id).toBe("2");
  });

  test("resolveCurrentLesson matches week lesson", () => {
    const slots = [{ _id: "slot1", day: "Thursday", startTime: "09:00", endTime: "09:30" }];
    const now = new Date("2026-01-15T09:10:00");
    const { year, weekNumber } = getIsoWeekYearAndNumber(now);
    const lessons = [
      {
        _id: "lesson1",
        slotId: "slot1",
        year,
        weekNumber,
        subject: { name: "Math", bgColor: "#fff", textColor: "#000" },
      },
    ];
    const result = resolveCurrentLesson(slots, lessons, new Set(), now);
    expect(result?.subject?.name).toBe("Math");
  });
});
