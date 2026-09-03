import { describe, expect, it } from "vite-plus/test";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { authz } from "./authz";
import { classScope } from "./lib/authzModel";
import { createConvexTest } from "./test.setup";

type Fixture = Awaited<ReturnType<typeof seedFixture>>;

async function seedFixture(test: ReturnType<typeof createConvexTest>) {
  await test.action(internal.authzBackfill.syncCatalogRoles, {});
  return await test.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      name: "Teacher",
      email: "teacher@example.com",
    });
    const classId = await ctx.db.insert("classes", {
      ownerId,
      name: "Timetable Lessons",
      year: 2026,
      studentLanguage: "en",
      updatedAt: 1,
    });
    await authz.assignRole(ctx, ownerId, "owner", classScope(classId));
    return { ownerId, classId };
  });
}

function asOwner(test: ReturnType<typeof createConvexTest>, fixture: Fixture) {
  return test.withIdentity({
    subject: fixture.ownerId,
    email: "teacher@example.com",
    name: "Teacher",
  });
}

async function seedSchedule(owner: ReturnType<typeof asOwner>, classId: Id<"classes">) {
  const termId = await owner.mutation(api.timetable.createTerm, {
    classId,
    name: "Spring",
    kind: "custom",
    startDateKey: "2026-01-01",
    endDateKey: "2026-06-30",
    days: ["Monday", "Tuesday", "Wednesday"],
    startTime: "08:00",
    endTime: "16:00",
  });
  const mondaySlotId = await owner.mutation(api.timetable.createSlot, {
    classId,
    termId,
    day: "Monday",
    startTime: "09:00",
    endTime: "10:00",
  });
  const tuesdaySlotId = await owner.mutation(api.timetable.createSlot, {
    classId,
    termId,
    day: "Tuesday",
    startTime: "09:00",
    endTime: "10:00",
  });
  const wednesdaySlotId = await owner.mutation(api.timetable.createSlot, {
    classId,
    termId,
    day: "Wednesday",
    startTime: "11:00",
    endTime: "12:00",
  });
  const subjectId = await owner.mutation(api.timetable.createSubject, {
    classId,
    name: "Math",
    bgColor: "#111111",
    textColor: "#ffffff",
    defaultMaterials: [],
    defaultAnnouncements: [],
    defaultAgenda: [],
    calendarAudienceRoles: ["student"],
  });
  return { termId, mondaySlotId, tuesdaySlotId, wednesdaySlotId, subjectId };
}

describe("timetable lesson move and auto-link", () => {
  it("moves a lesson to another slot and keeps its content", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);
    const schedule = await seedSchedule(owner, fixture.classId);

    const lessonId = await owner.mutation(api.timetable.addLessonToSlot, {
      classId: fixture.classId,
      termId: schedule.termId,
      slotId: schedule.mondaySlotId,
      subjectId: schedule.subjectId,
      year: 2026,
      weekNumber: 10,
    });
    await owner.mutation(api.timetable.upsertLesson, {
      classId: fixture.classId,
      termId: schedule.termId,
      slotId: schedule.mondaySlotId,
      subjectId: schedule.subjectId,
      year: 2026,
      weekNumber: 10,
      complete: true,
      materials: [{ key: "m1", text: "Bring workbook", tags: [] }],
      announcements: [],
      agenda: [],
    });

    await owner.mutation(api.timetable.moveLesson, {
      classId: fixture.classId,
      lessonId,
      targetSlotId: schedule.wednesdaySlotId,
    });

    const bundle = await owner.query(api.timetable.getWeekBundle, {
      classId: fixture.classId,
      termId: schedule.termId,
      year: 2026,
      weekNumber: 10,
    });
    const moved = bundle.lessons.find((lesson) => lesson._id === lessonId);
    expect(moved?.slotId).toBe(schedule.wednesdaySlotId);
    expect(moved?.complete).toBe(true);
    expect(moved?.materials[0]?.text).toBe("Bring workbook");
    expect(bundle.lessons.some((lesson) => lesson.slotId === schedule.mondaySlotId)).toBe(false);
  });

  it("auto-links the same subject on unlinked slots and mirrors edits", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);
    const schedule = await seedSchedule(owner, fixture.classId);

    const firstId = await owner.mutation(api.timetable.addLessonToSlot, {
      classId: fixture.classId,
      termId: schedule.termId,
      slotId: schedule.mondaySlotId,
      subjectId: schedule.subjectId,
      year: 2026,
      weekNumber: 10,
    });
    await owner.mutation(api.timetable.upsertLesson, {
      classId: fixture.classId,
      termId: schedule.termId,
      slotId: schedule.mondaySlotId,
      subjectId: schedule.subjectId,
      year: 2026,
      weekNumber: 10,
      complete: false,
      materials: [{ key: "m1", text: "Shared notes", tags: [] }],
      announcements: [],
      agenda: [],
    });

    const secondId = await owner.mutation(api.timetable.addLessonToSlot, {
      classId: fixture.classId,
      termId: schedule.termId,
      slotId: schedule.tuesdaySlotId,
      subjectId: schedule.subjectId,
      year: 2026,
      weekNumber: 10,
    });

    let bundle = await owner.query(api.timetable.getWeekBundle, {
      classId: fixture.classId,
      termId: schedule.termId,
      year: 2026,
      weekNumber: 10,
    });
    const first = bundle.lessons.find((lesson) => lesson._id === firstId);
    const second = bundle.lessons.find((lesson) => lesson._id === secondId);
    expect(first?.lessonLinkGroupId).toBeTruthy();
    expect(second?.lessonLinkGroupId).toBe(first?.lessonLinkGroupId);
    expect(second?.materials[0]?.text).toBe("Shared notes");

    await owner.mutation(api.timetable.upsertLesson, {
      classId: fixture.classId,
      termId: schedule.termId,
      slotId: schedule.tuesdaySlotId,
      subjectId: schedule.subjectId,
      year: 2026,
      weekNumber: 10,
      complete: true,
      materials: [{ key: "m1", text: "Updated notes", tags: [] }],
      announcements: [],
      agenda: [],
    });

    bundle = await owner.query(api.timetable.getWeekBundle, {
      classId: fixture.classId,
      termId: schedule.termId,
      year: 2026,
      weekNumber: 10,
    });
    expect(bundle.lessons.map((lesson) => lesson.materials[0]?.text)).toEqual([
      "Updated notes",
      "Updated notes",
    ]);
    expect(bundle.lessons.every((lesson) => lesson.complete)).toBe(true);

    await owner.mutation(api.timetable.unlinkLesson, {
      classId: fixture.classId,
      lessonId: secondId,
    });
    bundle = await owner.query(api.timetable.getWeekBundle, {
      classId: fixture.classId,
      termId: schedule.termId,
      year: 2026,
      weekNumber: 10,
    });
    expect(bundle.lessons.every((lesson) => lesson.lessonLinkGroupId === undefined)).toBe(true);
  });

  it("rejects moving onto a slot that already has the subject", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);
    const schedule = await seedSchedule(owner, fixture.classId);

    const lessonId = await owner.mutation(api.timetable.addLessonToSlot, {
      classId: fixture.classId,
      termId: schedule.termId,
      slotId: schedule.mondaySlotId,
      subjectId: schedule.subjectId,
      year: 2026,
      weekNumber: 10,
    });
    await owner.mutation(api.timetable.addLessonToSlot, {
      classId: fixture.classId,
      termId: schedule.termId,
      slotId: schedule.wednesdaySlotId,
      subjectId: schedule.subjectId,
      year: 2026,
      weekNumber: 10,
    });

    await expect(
      owner.mutation(api.timetable.moveLesson, {
        classId: fixture.classId,
        lessonId,
        targetSlotId: schedule.wednesdaySlotId,
      }),
    ).rejects.toThrow(/already has this subject/);
  });
});
