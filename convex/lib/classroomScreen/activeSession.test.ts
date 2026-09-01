import { describe, expect, test } from "vitest";

import {
  advanceSegment,
  buildCustomTimerSession,
  buildQuickPresetSession,
  buildRotationSession,
  buildTimerChainSegments,
  getRotationEndTimes,
  hasUpcomingSegments,
  isRotationSession,
  parseSessionJson,
  remainingFromDisplaySession,
  resolveSegmentDuration,
  truncateUpcomingSegments,
  type TimerDoc,
} from "./activeSession.js";
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
    const segments = buildTimerChainSegments(timers[0]!, timers, "UTC");
    expect(segments).toHaveLength(2);
  });

  test("buildCustomTimerSession uses chain when provided", () => {
    const timers: TimerDoc[] = [
      { _id: "a", name: "A", durationSeconds: 10, bgColor: "#111", nextTimerId: "b" },
      { _id: "b", name: "B", durationSeconds: 20, bgColor: "#222" },
    ];
    const session = buildCustomTimerSession(timers[0]!, "UTC", undefined, timers);
    expect(session.segments).toHaveLength(2);
  });

  test("parseSessionJson rejects invalid payloads", () => {
    expect(parseSessionJson(null)).toBeNull();
    expect(parseSessionJson({ index: 0 })).toBeNull();
  });

  test("buildRotationSession uses work then transition and omits a trailing transition", () => {
    const session = buildRotationSession({
      name: "Stations",
      rotationDurationSeconds: 300,
      numberOfRotations: 3,
      transitionDurationSeconds: 30,
      rotationBgColor: "#1e40af",
      transitionBgColor: "#6b7280",
    });

    expect(isRotationSession(session)).toBe(true);
    expect(session.segments.map((segment) => segment.kind)).toEqual([
      "work",
      "transition",
      "work",
      "transition",
      "work",
    ]);
    expect(session.segments[0]?.round).toBe(1);
    expect(session.segments[0]?.roundCount).toBe(3);
    expect(session.segments[0]?.durationSeconds).toBe(300);
    expect(session.segments[1]?.durationSeconds).toBe(30);
  });

  test("buildRotationSession can add a final transition and omits zero-duration transitions", () => {
    const withFinal = buildRotationSession({
      name: "Stations",
      rotationDurationSeconds: 60,
      numberOfRotations: 2,
      transitionDurationSeconds: 15,
      rotationBgColor: "#1e40af",
      transitionBgColor: "#6b7280",
      finalTransition: true,
    });
    expect(withFinal.segments.map((segment) => segment.kind)).toEqual([
      "work",
      "transition",
      "work",
      "transition",
    ]);

    const noTransition = buildRotationSession({
      name: "Stations",
      rotationDurationSeconds: 60,
      numberOfRotations: 2,
      transitionDurationSeconds: 0,
      rotationBgColor: "#1e40af",
      transitionBgColor: "#6b7280",
      finalTransition: true,
    });
    expect(noTransition.segments.map((segment) => segment.kind)).toEqual(["work", "work"]);
  });

  test("buildRotationSession inherits audio cues segment then rotation then global", () => {
    const session = buildRotationSession(
      {
        name: "Stations",
        rotationDurationSeconds: 60,
        numberOfRotations: 1,
        transitionDurationSeconds: 0,
        rotationBgColor: "#1e40af",
        transitionBgColor: "#6b7280",
        workCues: { segmentStart: { audioId: "work-start" } },
        audioCues: {
          segmentStart: { audioId: "rotation-start" },
          segmentEnd: { audioId: "rot-end" },
        },
      },
      { segmentStart: { audioId: "global-start" }, segmentEnd: { audioId: "global-end" } },
    );

    expect(session.segments[0]?.audioCues.segmentStart.audioId).toBe("work-start");
    expect(session.segments[0]?.audioCues.segmentEnd.audioId).toBe("rot-end");
  });

  test("getRotationEndTimes projects work-round end times from the current segment", () => {
    const session = buildRotationSession({
      name: "Stations",
      rotationDurationSeconds: 60,
      numberOfRotations: 2,
      transitionDurationSeconds: 30,
      rotationBgColor: "#1e40af",
      transitionBgColor: "#6b7280",
    });
    const currentEndsAt = 1_000_000;
    const ends = getRotationEndTimes(session, currentEndsAt);

    expect(ends).toHaveLength(2);
    expect(ends[0]).toMatchObject({ endMs: currentEndsAt, isCurrent: true, round: 1 });
    expect(ends[1]).toMatchObject({
      endMs: currentEndsAt + 30_000 + 60_000,
      isCurrent: false,
      round: 2,
    });
  });

  test("remainingFromDisplaySession respects pause", () => {
    expect(remainingFromDisplaySession(Date.now() + 5000, false, undefined, Date.now())).toBe(5);
    expect(remainingFromDisplaySession(null, true, 4500, Date.now())).toBe(4);
  });
});

describe("end-time timers", () => {
  const sydneyNow = Date.parse("2026-09-01T05:00:00.000Z");
  const timer: TimerDoc = {
    _id: "end",
    name: "Until 16:00",
    durationSeconds: 1,
    bgColor: "#111",
    endTime: "16:00:00",
  };

  test("resolveSegmentDuration uses the class timezone for wall-clock end times", () => {
    const session = buildCustomTimerSession(
      timer,
      "Australia/Sydney",
      undefined,
      undefined,
      sydneyNow,
    );
    expect(resolveSegmentDuration(session.segments[0]!, "Australia/Sydney", sydneyNow)).toBe(3600);
    expect(resolveSegmentDuration(session.segments[0]!, "UTC", sydneyNow)).toBe(11 * 3600);
  });

  test("buildCustomTimerSession duration matches resolveSegmentDuration in the same zone", () => {
    const session = buildCustomTimerSession(
      timer,
      "Australia/Sydney",
      undefined,
      undefined,
      sydneyNow,
    );
    expect(session.segments[0]?.durationSeconds).toBe(3600);
    expect(resolveSegmentDuration(session.segments[0]!, "Australia/Sydney", sydneyNow)).toBe(
      session.segments[0]?.durationSeconds,
    );
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

  test("findCurrentSlot uses the class timezone instead of UTC", () => {
    const slots = [{ _id: "sat", day: "Saturday", startTime: "16:00", endTime: "20:30" }];
    const utcMorning = new Date("2026-08-29T09:03:00.000Z");
    expect(findCurrentSlot(slots, utcMorning, "Asia/Seoul")?._id).toBe("sat");
    expect(findCurrentSlot(slots, utcMorning, "UTC")).toBeNull();
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
