import { describe, expect, it } from "vite-plus/test";

import type { ClassroomDisplayBundle } from "@/hooks/classroomScreen/useClassroomScreenQueries";
import {
  lessonSlotTimes,
  resolveLessonDisplayState,
  resolveLessonDisplayStatus,
} from "@/lib/classroomScreen/lessonDisplayState";

function makeBundle(
  partial: Partial<ClassroomDisplayBundle> &
    Pick<ClassroomDisplayBundle, "settings" | "displaySession">,
): ClassroomDisplayBundle {
  return {
    pushedLesson: null,
    currentLesson: null,
    currentSlot: null,
    timeZone: "UTC",
    ...partial,
  };
}

function makeLesson(
  partial: Partial<NonNullable<ClassroomDisplayBundle["currentLesson"]>> &
    Pick<NonNullable<ClassroomDisplayBundle["currentLesson"]>, "_id" | "slotId" | "subjectName">,
): NonNullable<ClassroomDisplayBundle["currentLesson"]> {
  return {
    subjectBgColor: "#111111",
    subjectTextColor: "#ffffff",
    materials: [],
    announcements: [],
    agenda: [],
    upcomingEvents: [],
    resources: [],
    timeZone: "UTC",
    ...partial,
  };
}

describe("resolveLessonDisplayState", () => {
  const slotId = "slot1" as NonNullable<ClassroomDisplayBundle["currentLesson"]>["slotId"];
  const lesson = makeLesson({
    _id: "lesson1" as NonNullable<ClassroomDisplayBundle["currentLesson"]>["_id"],
    slotId,
    subjectName: "Math",
  });

  it("returns empty state when bundle is missing", () => {
    expect(resolveLessonDisplayState(null)).toEqual({
      pushActive: false,
      activeLesson: null,
      autoSlot: null,
      showLessonContent: false,
      globalQuickText: null,
    });
  });

  it("prefers an active pushed lesson over the timetable lesson", () => {
    const now = Date.parse("2026-08-29T10:00:00.000Z");
    const pushedLesson = makeLesson({
      _id: "pushed" as NonNullable<ClassroomDisplayBundle["currentLesson"]>["_id"],
      slotId: "slot2" as NonNullable<ClassroomDisplayBundle["currentLesson"]>["slotId"],
      subjectName: "Override",
    });

    const state = resolveLessonDisplayState(
      makeBundle({
        settings: { quickText: "Reminder" } as ClassroomDisplayBundle["settings"],
        displaySession: {
          pushedUntil: now + 60_000,
        } as unknown as ClassroomDisplayBundle["displaySession"],
        pushedLesson,
        currentLesson: lesson,
        currentSlot: {
          _id: slotId,
          day: "Friday",
          startTime: "09:00",
          endTime: "10:00",
          disabled: false,
        },
      }),
      now,
    );

    expect(state.pushActive).toBe(true);
    expect(state.activeLesson?.subjectName).toBe("Override");
    expect(state.globalQuickText).toBeNull();
  });

  it("falls back to the current timetable lesson when push override expired", () => {
    const now = new Date("2026-08-29T10:30:00");
    const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
    const state = resolveLessonDisplayState(
      makeBundle({
        settings: { quickText: null } as unknown as ClassroomDisplayBundle["settings"],
        displaySession: {
          pushedUntil: now.getTime() - 1_000,
        } as unknown as ClassroomDisplayBundle["displaySession"],
        pushedLesson: makeLesson({
          _id: "pushed" as NonNullable<ClassroomDisplayBundle["currentLesson"]>["_id"],
          slotId: "slot2" as NonNullable<ClassroomDisplayBundle["currentLesson"]>["slotId"],
          subjectName: "Override",
        }),
        currentLesson: lesson,
        currentSlot: {
          _id: slotId,
          day: dayName,
          startTime: "10:00",
          endTime: "11:00",
          disabled: false,
        },
      }),
      now,
    );

    expect(state.pushActive).toBe(false);
    expect(state.activeLesson?.subjectName).toBe("Math");
    expect(state.showLessonContent).toBe(true);
  });

  it("shows quick text when there is no active lesson", () => {
    const state = resolveLessonDisplayState(
      makeBundle({
        settings: { quickText: "Pack your books" } as ClassroomDisplayBundle["settings"],
        displaySession: {} as unknown as ClassroomDisplayBundle["displaySession"],
      }),
    );

    expect(state.showLessonContent).toBe(false);
    expect(state.globalQuickText).toBe("Pack your books");
  });

  it("returns empty when there is no lesson or quick text", () => {
    const state = resolveLessonDisplayState(
      makeBundle({
        settings: { quickText: null } as unknown as ClassroomDisplayBundle["settings"],
        displaySession: {} as unknown as ClassroomDisplayBundle["displaySession"],
      }),
    );

    expect(state.showLessonContent).toBe(false);
    expect(state.globalQuickText).toBeNull();
  });
});

describe("resolveLessonDisplayStatus", () => {
  it("returns pushed status when override is active", () => {
    const pushedUntil = Date.now() + 120_000;
    const state = resolveLessonDisplayState(null);
    const status = resolveLessonDisplayStatus(
      { ...state, pushActive: true, showLessonContent: true },
      pushedUntil,
    );

    expect(status).toEqual({ kind: "pushed", pushedUntil });
  });

  it("returns upcoming status during early preview", () => {
    const now = new Date("2026-08-29T09:58:00.000Z");
    const slot = {
      _id: "slot1" as NonNullable<ClassroomDisplayBundle["currentLesson"]>["slotId"],
      day: "Saturday",
      startTime: "10:00",
      endTime: "11:00",
      disabled: false,
    };
    const state = resolveLessonDisplayState(
      makeBundle({
        settings: { quickText: null } as unknown as ClassroomDisplayBundle["settings"],
        displaySession: {} as unknown as ClassroomDisplayBundle["displaySession"],
        currentSlot: slot,
        currentLesson: makeLesson({
          _id: "lesson1" as NonNullable<ClassroomDisplayBundle["currentLesson"]>["_id"],
          slotId: slot._id,
          subjectName: "Math",
          timeZone: "UTC",
        }),
      }),
      now,
    );

    expect(resolveLessonDisplayStatus(state, null, now)).toEqual({ kind: "upcoming", minutes: 2 });
  });

  it("returns current, quick text, and empty statuses", () => {
    const now = new Date("2026-08-29T10:30:00.000Z");
    const slot = {
      _id: "slot1" as NonNullable<ClassroomDisplayBundle["currentLesson"]>["slotId"],
      day: "Saturday",
      startTime: "10:00",
      endTime: "11:00",
      disabled: false,
    };
    const currentState = resolveLessonDisplayState(
      makeBundle({
        settings: { quickText: null } as unknown as ClassroomDisplayBundle["settings"],
        displaySession: {} as unknown as ClassroomDisplayBundle["displaySession"],
        currentSlot: slot,
        currentLesson: makeLesson({
          _id: "lesson1" as NonNullable<ClassroomDisplayBundle["currentLesson"]>["_id"],
          slotId: slot._id,
          subjectName: "Math",
          timeZone: "UTC",
        }),
      }),
      now,
    );

    expect(resolveLessonDisplayStatus(currentState, null, now)).toEqual({ kind: "current" });

    const quickTextState = resolveLessonDisplayState(
      makeBundle({
        settings: { quickText: "Reminder" } as ClassroomDisplayBundle["settings"],
        displaySession: {} as unknown as ClassroomDisplayBundle["displaySession"],
      }),
    );
    expect(resolveLessonDisplayStatus(quickTextState, null)).toEqual({ kind: "quickText" });
    expect(resolveLessonDisplayStatus(quickTextState, null, now)).toEqual({ kind: "quickText" });

    const emptyState = resolveLessonDisplayState(
      makeBundle({
        settings: { quickText: null } as unknown as ClassroomDisplayBundle["settings"],
        displaySession: {} as unknown as ClassroomDisplayBundle["displaySession"],
      }),
    );
    expect(resolveLessonDisplayStatus(emptyState, null)).toEqual({ kind: "empty" });
  });
});

describe("lessonSlotTimes", () => {
  const currentSlot = { startTime: "09:00", endTime: "09:50" };

  it("uses the lesson slot when start and end are present", () => {
    expect(lessonSlotTimes({ startTime: "10:00", endTime: "10:45" }, currentSlot)).toEqual({
      startTime: "10:00",
      endTime: "10:45",
    });
  });

  it("falls back to the current slot when the lesson has no times", () => {
    expect(lessonSlotTimes({}, currentSlot)).toEqual(currentSlot);
  });

  it("returns null when neither the lesson nor the current slot has times", () => {
    expect(lessonSlotTimes(null, null)).toBeNull();
  });
});
