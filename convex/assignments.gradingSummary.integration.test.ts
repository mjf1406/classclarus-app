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
      name: "Grading Summary Test",
      year: 2026,
      studentLanguage: "en",
      updatedAt: 1,
    });
    const studentId = await ctx.db.insert("users", {
      name: "Student 1",
      email: "student1@example.com",
    });
    const studentTwoId = await ctx.db.insert("users", {
      name: "Student 2",
      email: "student2@example.com",
    });
    await ctx.db.insert("studentRosters", {
      classId,
      userId: studentId,
      rosterNumber: 1,
      firstName: "Student1",
    });
    await ctx.db.insert("studentRosters", {
      classId,
      userId: studentTwoId,
      rosterNumber: 2,
      firstName: "Student2",
    });

    const scope = classScope(classId);
    await authz.assignRole(ctx, ownerId, "owner", scope);
    await authz.assignRole(ctx, studentId, "student", scope);
    await authz.assignRole(ctx, studentTwoId, "student", scope);

    const now = 1_700_000_000_000;
    const needsGradingId = await ctx.db.insert("assignments", {
      classId,
      name: "Quiz 1",
      scoringMode: "total",
      totalPoints: 10,
      procedureSteps: [],
      expectationIds: [],
      acceptLinkSubmissions: true,
      scoresReleased: false,
      createdBy: ownerId,
      createdAt: now,
      updatedAt: now,
    });
    const fullyGradedId = await ctx.db.insert("assignments", {
      classId,
      name: "Quiz 2",
      scoringMode: "total",
      totalPoints: 10,
      procedureSteps: [],
      expectationIds: [],
      acceptLinkSubmissions: true,
      scoresReleased: false,
      createdBy: ownerId,
      createdAt: now + 1,
      updatedAt: now + 1,
    });
    const excusedId = await ctx.db.insert("assignments", {
      classId,
      name: "Quiz 3",
      scoringMode: "total",
      totalPoints: 10,
      procedureSteps: [],
      expectationIds: [],
      acceptLinkSubmissions: true,
      scoresReleased: false,
      createdBy: ownerId,
      createdAt: now + 2,
      updatedAt: now + 2,
    });

    await ctx.db.insert("assignmentStudentLinks", {
      classId,
      assignmentId: needsGradingId,
      studentUserId: studentId,
      url: "https://example.com/quiz1",
      handedIn: true,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("assignmentStudentLinks", {
      classId,
      assignmentId: needsGradingId,
      studentUserId: studentTwoId,
      url: "https://example.com/quiz1b",
      handedIn: true,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("assignmentScores", {
      classId,
      assignmentId: needsGradingId,
      studentUserId: studentId,
      totalPointsEarned: 8,
      updatedAt: now,
      updatedBy: ownerId,
    });

    await ctx.db.insert("assignmentStudentLinks", {
      classId,
      assignmentId: fullyGradedId,
      studentUserId: studentId,
      url: "https://example.com/quiz2",
      handedIn: true,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("assignmentScores", {
      classId,
      assignmentId: fullyGradedId,
      studentUserId: studentId,
      totalPointsEarned: 9,
      updatedAt: now,
      updatedBy: ownerId,
    });

    await ctx.db.insert("assignmentStudentLinks", {
      classId,
      assignmentId: excusedId,
      studentUserId: studentId,
      url: "https://example.com/quiz3",
      handedIn: true,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("assignmentScores", {
      classId,
      assignmentId: excusedId,
      studentUserId: studentId,
      excused: true,
      updatedAt: now,
      updatedBy: ownerId,
    });

    return { ownerId, classId, studentId, needsGradingId };
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
    email: "student1@example.com",
    name: "Student 1",
  });
}

describe("assignments gradingSummary", () => {
  it("returns assignments with handed-in students who still need a grade", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);

    const summary = await owner.query(api.assignments.gradingSummary, {
      classId: fixture.classId,
    });

    expect(summary).toEqual([
      {
        _id: fixture.needsGradingId,
        name: "Quiz 1",
        handedInCount: 2,
        ungradedCount: 1,
      },
    ]);
  });

  it("rejects students who cannot manage assignments", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const student = asStudent(test, fixture);

    await expect(
      student.query(api.assignments.gradingSummary, { classId: fixture.classId }),
    ).rejects.toThrow();
  });
});
