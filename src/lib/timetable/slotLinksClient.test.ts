import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vite-plus/test";

import type { Id } from "../../../convex/_generated/dataModel";
import { mirrorLessonsInBundle } from "./slotLinksClient";
import type { TimetableWeekBundle } from "./timetable";

const classId = "classes:1" as Id<"classes">;
const termId = "terms:1" as Id<"timetableTerms">;
const slotA = "slots:a" as Id<"timetableSlots">;
const slotB = "slots:b" as Id<"timetableSlots">;
const subjectId = "subjects:math" as Id<"timetableSubjects">;
const lessonA = "lessons:a" as Id<"timetableLessons">;
const lessonB = "lessons:b" as Id<"timetableLessons">;

function subject() {
  return {
    _id: subjectId,
    _creationTime: 1,
    classId,
    name: "Math",
    bgColor: "#111111",
    textColor: "#ffffff",
    iconName: undefined,
    defaultMaterials: [],
    defaultAnnouncements: [],
    defaultAgenda: [],
    calendarAudienceRoles: ["student"],
    createdAt: 1,
    updatedAt: 1,
  };
}

function lesson(
  id: Id<"timetableLessons">,
  slotId: Id<"timetableSlots">,
  materials: TimetableWeekBundle["lessons"][number]["materials"],
): TimetableWeekBundle["lessons"][number] {
  return {
    _id: id,
    _creationTime: 1,
    classId,
    termId,
    slotId,
    subjectId,
    year: 2026,
    weekNumber: 10,
    complete: false,
    materials,
    announcements: [],
    agenda: [],
    lessonUrl: undefined,
    lessonUrlShared: false,
    createdAt: 1,
    updatedAt: 1,
    subject: subject(),
    upcomingEvents: [],
  };
}

function bundle(): TimetableWeekBundle {
  return {
    term: {
      _id: termId,
      _creationTime: 1,
      classId,
      name: "Term",
      kind: "custom",
      startDateKey: "2026-01-01",
      endDateKey: "2026-06-01",
      days: ["Monday"],
      startTime: "08:00",
      endTime: "16:00",
      createdBy: "users:1" as Id<"users">,
      createdAt: 1,
      updatedAt: 1,
    },
    slots: [
      {
        _id: slotA,
        _creationTime: 1,
        classId,
        termId,
        day: "Monday",
        startTime: "09:00",
        endTime: "10:00",
        disabled: false,
        linkGroupId: "g1",
        createdAt: 1,
        updatedAt: 1,
      },
      {
        _id: slotB,
        _creationTime: 1,
        classId,
        termId,
        day: "Tuesday",
        startTime: "09:00",
        endTime: "10:00",
        disabled: false,
        linkGroupId: "g1",
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    subjects: [subject()],
    lessons: [
      lesson(lessonA, slotA, [{ key: "m1", text: "Old notes", tags: [] }]),
      lesson(lessonB, slotB, [{ key: "m1", text: "Old notes", tags: [] }]),
    ],
    disabledSlotIds: [],
  };
}

describe("mirrorLessonsInBundle", () => {
  test("mirrors structured sections and can roll back a cache snapshot", () => {
    const queryClient = new QueryClient();
    const key = ["timetable-week"];
    const previous = bundle();
    queryClient.setQueryData(key, previous);

    const nextMaterials = [{ key: "m1", text: "Bring #workbook", tags: ["workbook"] }];
    const updatedPrimary = {
      ...previous,
      lessons: previous.lessons.map((item) =>
        item._id === lessonA ? { ...item, materials: nextMaterials } : item,
      ),
    };
    const optimistic = mirrorLessonsInBundle(updatedPrimary, slotA, 2026, 10, {
      type: "update",
      sourceLesson: {
        _id: lessonA,
        slotId: slotA,
        subjectId,
        year: 2026,
        weekNumber: 10,
        complete: false,
        materials: nextMaterials,
        announcements: [],
        agenda: [],
      },
    });
    queryClient.setQueryData(key, optimistic);

    expect(
      queryClient.getQueryData<TimetableWeekBundle>(key)?.lessons.map((item) => item.materials),
    ).toEqual([nextMaterials, nextMaterials]);

    queryClient.setQueryData(key, previous);
    expect(queryClient.getQueryData(key)).toEqual(previous);
  });
});
