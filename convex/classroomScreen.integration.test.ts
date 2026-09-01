import { describe, expect, it } from "vite-plus/test";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { authz } from "./authz";
import { classScope } from "./lib/authzModel";
import {
  buildCustomTimerSession,
  buildQuickPresetSession,
} from "./lib/classroomScreen/activeSession";
import { secondsUntilEndTime } from "./lib/classroomScreen/timerUtils";
import { utcMsToZonedParts } from "./lib/calendar/timeZone";
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
      name: "Classroom Screen Test",
      year: 2026,
      studentLanguage: "en",
      updatedAt: 1,
    });

    const studentId = await ctx.db.insert("users", {
      name: "Student",
      email: "student@example.com",
    });
    await ctx.db.insert("studentRosters", {
      classId,
      userId: studentId,
      rosterNumber: 1,
      firstName: "Student",
    });

    const guardianId = await ctx.db.insert("users", {
      name: "Guardian",
      email: "guardian@example.com",
    });

    const scope = classScope(classId);
    await authz.assignRole(ctx, ownerId, "owner", scope);
    await authz.assignRole(ctx, studentId, "student", scope);
    await authz.assignRole(ctx, guardianId, "guardian", scope);
    await ctx.db.insert("guardianStudentLinks", {
      classId,
      guardianUserId: guardianId,
      studentUserId: studentId,
      createdAt: 1,
      createdBy: ownerId,
    });

    return { classId, ownerId, studentId, guardianId };
  });
}

function asOwner(test: ReturnType<typeof createConvexTest>, fixture: Fixture) {
  return test.withIdentity({
    subject: fixture.ownerId,
    email: "teacher@example.com",
    name: "Teacher",
  });
}

function asStudent(test: ReturnType<typeof createConvexTest>, fixture: Fixture) {
  return test.withIdentity({
    subject: fixture.studentId,
    email: "student@example.com",
    name: "Student",
  });
}

function asGuardian(test: ReturnType<typeof createConvexTest>, fixture: Fixture) {
  return test.withIdentity({
    subject: fixture.guardianId,
    email: "guardian@example.com",
    name: "Guardian",
  });
}

function sampleSession() {
  return buildQuickPresetSession(60, "#15803d");
}

describe("classroom screen authorization", () => {
  it("allows read-only roles to query the live display bundle", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const student = asStudent(test, fixture);
    const guardian = asGuardian(test, fixture);
    const nowMinuteBucket = Math.floor(Date.now() / 60_000);

    await expect(
      student.query(api.classroomScreen.getDisplayBundle, {
        classId: fixture.classId,
        nowMinuteBucket,
      }),
    ).resolves.toMatchObject({
      settings: expect.objectContaining({ classId: fixture.classId }),
    });
    await expect(
      guardian.query(api.classroomScreen.getDisplayBundle, {
        classId: fixture.classId,
        nowMinuteBucket,
      }),
    ).resolves.toBeDefined();
  });

  it("rejects read-only roles for shared display session mutations", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const student = asStudent(test, fixture);
    const guardian = asGuardian(test, fixture);
    const session = sampleSession();

    for (const client of [student, guardian]) {
      await expect(
        client.mutation(api.classroomScreen.startSession, {
          classId: fixture.classId,
          session,
        }),
      ).rejects.toThrow();
      await expect(
        client.mutation(api.classroomScreen.stopSession, { classId: fixture.classId }),
      ).rejects.toThrow();
      await expect(
        client.mutation(api.classroomScreen.pauseSession, {
          classId: fixture.classId,
          remainingMs: 30_000,
        }),
      ).rejects.toThrow();
      await expect(
        client.mutation(api.classroomScreen.resumeSession, {
          classId: fixture.classId,
          remainingMs: 30_000,
        }),
      ).rejects.toThrow();
      await expect(
        client.mutation(api.classroomScreen.adjustSession, {
          classId: fixture.classId,
          deltaSeconds: 30,
        }),
      ).rejects.toThrow();
      await expect(
        client.mutation(api.classroomScreen.updateSession, {
          classId: fixture.classId,
          session,
        }),
      ).rejects.toThrow();
      await expect(
        client.mutation(api.classroomScreen.skipSessionSegment, { classId: fixture.classId }),
      ).rejects.toThrow();
      await expect(
        client.mutation(api.classroomScreen.clearPushedLesson, { classId: fixture.classId }),
      ).rejects.toThrow();
    }
  });

  it("allows managers to control the shared display session", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);
    const session = sampleSession();

    await owner.mutation(api.classroomScreen.startSession, {
      classId: fixture.classId,
      session,
    });

    const bundle = await owner.query(api.classroomScreen.getDisplayBundle, {
      classId: fixture.classId,
      nowMinuteBucket: Math.floor(Date.now() / 60_000),
    });
    expect(bundle.displaySession.sessionJson).toBeDefined();

    await owner.mutation(api.classroomScreen.pauseSession, {
      classId: fixture.classId,
      remainingMs: 45_000,
    });
    await owner.mutation(api.classroomScreen.resumeSession, {
      classId: fixture.classId,
      remainingMs: 45_000,
    });
    await owner.mutation(api.classroomScreen.adjustSession, {
      classId: fixture.classId,
      deltaSeconds: 15,
    });
    await owner.mutation(api.classroomScreen.skipSessionSegment, { classId: fixture.classId });
    await owner.mutation(api.classroomScreen.stopSession, { classId: fixture.classId });

    const cleared = await owner.query(api.classroomScreen.getDisplayBundle, {
      classId: fixture.classId,
      nowMinuteBucket: Math.floor(Date.now() / 60_000),
    });
    expect(cleared.displaySession.sessionJson).toBeUndefined();
  });
});

const sampleRotation = {
  name: "Stations",
  rotationDurationSeconds: 300,
  numberOfRotations: 4,
  transitionDurationSeconds: 30,
  rotationBgColor: "#1e40af",
  transitionBgColor: "#6b7280",
  finalTransition: false,
};

describe("classroom rotations", () => {
  it("lets managers create, list, update, and delete rotations", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);

    const rotationId = await owner.mutation(api.classroomScreen.createRotation, {
      classId: fixture.classId,
      ...sampleRotation,
    });

    const listed = await owner.query(api.classroomScreen.listRotations, {
      classId: fixture.classId,
    });
    expect(listed).toHaveLength(1);
    expect(listed[0]?._id).toBe(rotationId);
    expect(listed[0]?.name).toBe("Stations");

    await owner.mutation(api.classroomScreen.updateRotation, {
      classId: fixture.classId,
      rotationId,
      ...sampleRotation,
      name: "Centers",
    });

    const updated = await owner.query(api.classroomScreen.listRotations, {
      classId: fixture.classId,
    });
    expect(updated[0]?.name).toBe("Centers");

    await owner.mutation(api.classroomScreen.deleteRotation, {
      classId: fixture.classId,
      rotationId,
    });
    const afterDelete = await owner.query(api.classroomScreen.listRotations, {
      classId: fixture.classId,
    });
    expect(afterDelete).toHaveLength(0);

    const activity = await test.run(async (ctx) => {
      return await ctx.db
        .query("classActivityEvents")
        .withIndex("by_class_resource_createdAt", (q) =>
          q.eq("classId", fixture.classId).eq("resourceType", "classroomRotation"),
        )
        .collect();
    });
    expect(activity.map((event) => event.summaryKey)).toEqual(
      expect.arrayContaining([
        "activitySummary_createdRotation",
        "activitySummary_updatedRotation",
        "activitySummary_deletedRotation",
      ]),
    );
  });

  it("rejects read-only roles and isolates classes", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);
    const student = asStudent(test, fixture);
    const guardian = asGuardian(test, fixture);

    const otherClassId = await test.run(async (ctx) => {
      return await ctx.db.insert("classes", {
        ownerId: fixture.ownerId,
        name: "Other class",
        year: 2026,
        studentLanguage: "en",
        updatedAt: 1,
      });
    });

    const rotationId = await owner.mutation(api.classroomScreen.createRotation, {
      classId: fixture.classId,
      ...sampleRotation,
    });

    for (const client of [student, guardian]) {
      await expect(
        client.query(api.classroomScreen.listRotations, { classId: fixture.classId }),
      ).resolves.toHaveLength(1);
      await expect(
        client.mutation(api.classroomScreen.createRotation, {
          classId: fixture.classId,
          ...sampleRotation,
          name: "Blocked",
        }),
      ).rejects.toThrow();
      await expect(
        client.mutation(api.classroomScreen.updateRotation, {
          classId: fixture.classId,
          rotationId,
          ...sampleRotation,
          name: "Blocked",
        }),
      ).rejects.toThrow();
      await expect(
        client.mutation(api.classroomScreen.deleteRotation, {
          classId: fixture.classId,
          rotationId,
        }),
      ).rejects.toThrow();
    }

    await expect(
      owner.mutation(api.classroomScreen.updateRotation, {
        classId: otherClassId,
        rotationId,
        ...sampleRotation,
        name: "Stolen",
      }),
    ).rejects.toThrow();
  });

  it("rejects invalid rotation input", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);

    await expect(
      owner.mutation(api.classroomScreen.createRotation, {
        classId: fixture.classId,
        ...sampleRotation,
        name: "   ",
      }),
    ).rejects.toThrow();
    await expect(
      owner.mutation(api.classroomScreen.createRotation, {
        classId: fixture.classId,
        ...sampleRotation,
        numberOfRotations: 0,
      }),
    ).rejects.toThrow();
    await expect(
      owner.mutation(api.classroomScreen.createRotation, {
        classId: fixture.classId,
        ...sampleRotation,
        rotationBgColor: "blue",
      }),
    ).rejects.toThrow();
  });
});

describe("classroom screen current lesson", () => {
  it("resolves the current lesson using the class timezone", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);
    const nowMs = Date.parse("2026-08-29T09:03:00.000Z");

    await test.run(async (ctx) => {
      await ctx.db.patch(fixture.classId, { timezone: "Asia/Seoul" });
      const now = Date.now();
      const termId = await ctx.db.insert("timetableTerms", {
        classId: fixture.classId,
        name: "Semester 2",
        kind: "semester",
        startDateKey: "2026-08-20",
        endDateKey: "2027-02-10",
        days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        startTime: "08:00",
        endTime: "21:00",
        createdBy: fixture.ownerId,
        createdAt: now,
        updatedAt: now,
      });
      const slotId = await ctx.db.insert("timetableSlots", {
        classId: fixture.classId,
        termId,
        day: "Saturday",
        startTime: "16:00",
        endTime: "20:30",
        disabled: false,
        createdAt: now,
        updatedAt: now,
      });
      const subjectId = await ctx.db.insert("timetableSubjects", {
        classId: fixture.classId,
        name: "Math",
        bgColor: "#111111",
        textColor: "#ffffff",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("timetableLessons", {
        classId: fixture.classId,
        termId,
        slotId,
        subjectId,
        year: 2026,
        weekNumber: 35,
        complete: false,
        links: [],
        materials: [{ key: "m1", text: "Workbook", tags: [] }],
        announcements: [{ key: "a1", text: "Bring scissors", tags: [] }],
        agenda: [{ key: "g1", text: "Warm up", tags: [], preface: "Center #1:" }],
        createdAt: now,
        updatedAt: now,
      });
    });

    const bundle = await owner.query(api.classroomScreen.getDisplayBundle, {
      classId: fixture.classId,
      nowMinuteBucket: Math.floor(nowMs / 60_000),
    });

    expect(bundle.currentSlot?.startTime).toBe("16:00");
    expect(bundle.currentSlot?.endTime).toBe("20:30");
    expect(bundle.currentLesson?.startTime).toBe("16:00");
    expect(bundle.currentLesson?.endTime).toBe("20:30");
    expect(bundle.currentLesson?.subjectName).toBe("Math");
    expect(bundle.currentLesson?.materials).toHaveLength(1);
    expect(bundle.currentLesson?.announcements).toHaveLength(1);
    expect(bundle.currentLesson?.agenda).toHaveLength(1);
    expect(bundle.currentLesson?.agenda[0]?.preface).toBe("Center #1:");
  });
});

describe("classroom end-time timers", () => {
  it("creates and starts an end-time timer in the class timezone", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);

    await test.run(async (ctx) => {
      await ctx.db.patch(fixture.classId, { timezone: "Australia/Sydney" });
    });

    await owner.mutation(api.classroomScreen.createTimer, {
      classId: fixture.classId,
      name: "Until 16:00",
      durationSeconds: 60,
      bgColor: "#15803d",
      endTime: "16:00:00",
    });

    const nowMs = Date.now();
    const expectedSeconds = secondsUntilEndTime("16:00:00", "Australia/Sydney", nowMs);
    const timers = await owner.query(api.classroomScreen.listTimers, {
      classId: fixture.classId,
    });
    const timer = timers[0];
    expect(timer?.endTime).toBe("16:00:00");
    expect(Math.abs((timer?.durationSeconds ?? 0) - expectedSeconds)).toBeLessThan(3);

    const session = buildCustomTimerSession(timer!, "Australia/Sydney");
    await owner.mutation(api.classroomScreen.startSession, {
      classId: fixture.classId,
      session,
    });

    const bundle = await owner.query(api.classroomScreen.getDisplayBundle, {
      classId: fixture.classId,
      nowMinuteBucket: Math.floor(Date.now() / 60_000),
    });
    expect(bundle.timeZone).toBe("Australia/Sydney");

    const endsAt = bundle.displaySession.endsAt;
    expect(endsAt).toBeDefined();
    const remainingSeconds = Math.round(((endsAt ?? 0) - Date.now()) / 1000);
    expect(Math.abs(remainingSeconds - (session.segments[0]?.durationSeconds ?? 0))).toBeLessThan(
      3,
    );
    const expectedEndsAt = nowMs + expectedSeconds * 1000;
    expect(Math.abs((endsAt ?? 0) - expectedEndsAt)).toBeLessThan(3000);
    expect(utcMsToZonedParts((endsAt ?? 0) + 1000, "Australia/Sydney").timeHm).toBe("16:00");
  });
});
