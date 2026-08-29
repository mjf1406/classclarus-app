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
      name: "Dashboard Test",
      year: 2026,
      studentLanguage: "en",
      updatedAt: 1,
    });

    const studentIds: Id<"users">[] = [];
    for (let index = 0; index < 3; index += 1) {
      const studentId = await ctx.db.insert("users", {
        name: `Student ${index + 1}`,
        email: `student${index + 1}@example.com`,
      });
      studentIds.push(studentId);
      await ctx.db.insert("studentRosters", {
        classId,
        userId: studentId,
        rosterNumber: index + 1,
        firstName: `Student${index + 1}`,
      });
    }

    const guardianId = await ctx.db.insert("users", {
      name: "Guardian",
      email: "guardian@example.com",
    });

    const scope = classScope(classId);
    await authz.assignRole(ctx, ownerId, "owner", scope);
    for (const studentId of studentIds) {
      await authz.assignRole(ctx, studentId, "student", scope);
    }
    await authz.assignRole(ctx, guardianId, "guardian", scope);
    await ctx.db.insert("guardianStudentLinks", {
      classId,
      guardianUserId: guardianId,
      studentUserId: studentIds[0]!,
      createdAt: 1,
      createdBy: ownerId,
    });

    const randomAssignerId = await ctx.db.insert("randomAssigners", {
      classId,
      name: "Chromebooks",
      items: ["A", "B", "C"],
      defaultReplicates: false,
      defaultScope: "class",
      createdBy: ownerId,
      createdAt: 1,
      updatedAt: 1,
    });

    const equitableAssignerId = await ctx.db.insert("equitableAssigners", {
      classId,
      name: "Jobs",
      items: ["Line leader", "Door holder"],
      defaultBalanceGender: false,
      defaultScope: "class",
      createdBy: ownerId,
      createdAt: 1,
      updatedAt: 1,
    });

    const emptyRandomAssignerId = await ctx.db.insert("randomAssigners", {
      classId,
      name: "Empty assigner",
      items: ["X"],
      defaultReplicates: false,
      defaultScope: "class",
      createdBy: ownerId,
      createdAt: 1,
      updatedAt: 1,
    });

    const randomRunId = await ctx.db.insert("randomAssignerRuns", {
      classId,
      assignerId: randomAssignerId,
      ranAt: 5000,
      ranBy: ownerId,
      scope: "class",
      replicates: false,
      itemsSnapshot: ["A", "B", "C"],
      assignments: [
        {
          studentUserId: studentIds[0]!,
          studentDisplayName: "Student 1",
          item: "A",
          rosterNumber: 1,
          firstName: "Student1",
        },
        {
          studentUserId: studentIds[1]!,
          studentDisplayName: "Student 2",
          item: "B",
          rosterNumber: 2,
          firstName: "Student2",
        },
      ],
    });

    const equitableRunId = await ctx.db.insert("equitableAssignerRuns", {
      classId,
      assignerId: equitableAssignerId,
      ranAt: 6000,
      ranBy: ownerId,
      scope: "class",
      balanceGender: false,
      itemsSnapshot: ["Line leader", "Door holder"],
      assignments: [
        {
          studentUserId: studentIds[0]!,
          studentDisplayName: "Student 1",
          item: "Line leader",
          rosterNumber: 1,
          firstName: "Student1",
        },
      ],
    });

    const layoutId = await ctx.db.insert("seatLayouts", {
      classId,
      name: "Main room",
      canvasWidth: 500,
      canvasHeight: 500,
      nextDeskNumber: 2,
      items: [],
      updatedAt: 1,
      createdBy: ownerId,
    });
    const chartId = await ctx.db.insert("seatCharts", {
      classId,
      layoutId,
      name: "Spring seats",
      assignments: [],
      updatedAt: 1,
      createdBy: ownerId,
    });
    const recordId = await ctx.db.insert("seatChartRecords", {
      classId,
      chartId,
      recordedAt: 7000,
      recordedBy: ownerId,
      chartName: "Spring seats",
      layoutId,
      layoutName: "Main room",
      canvasWidth: 500,
      canvasHeight: 500,
      layoutItems: [],
      placedCount: 1,
      seatedStudentIds: [studentIds[0]!],
    });
    await ctx.db.insert("seatChartPlacements", {
      classId,
      chartId,
      layoutId,
      recordId,
      studentUserId: studentIds[0]!,
      studentDisplayName: "Student 1",
      deskItemId: "desk-1",
      deskNumber: 4,
      zoneName: "Window",
      teamKey: "name:Blue",
      teamLabel: "Blue",
      neighborStudentIds: [],
      neighborDisplayNames: ["Student 2"],
      combinationKey: "combo-1",
      recordedAt: 7000,
    });

    return {
      ownerId,
      classId,
      studentIds,
      guardianId,
      randomAssignerId,
      equitableAssignerId,
      emptyRandomAssignerId,
      randomRunId,
      equitableRunId,
    };
  });
}

function asStudent(test: ReturnType<typeof createConvexTest>, fixture: Fixture, index = 0) {
  const studentId = fixture.studentIds[index]!;
  return test.withIdentity({
    subject: studentId,
    email: `student${index + 1}@example.com`,
    name: `Student ${index + 1}`,
  });
}

function asGuardian(test: ReturnType<typeof createConvexTest>, fixture: Fixture) {
  return test.withIdentity({
    subject: fixture.guardianId,
    email: "guardian@example.com",
    name: "Guardian",
  });
}

describe("dashboard assigner snapshot", () => {
  it("returns personal assignments and seat current for a student", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const student = asStudent(test, fixture, 0);
    const studentUserId = fixture.studentIds[0]!;

    const snapshot = await student.query(api.dashboard.assignerSnapshotForAudience, {
      classId: fixture.classId,
      studentUserId,
    });

    expect(snapshot.seatCurrent).toMatchObject({
      chartName: "Spring seats",
      layoutName: "Main room",
      deskNumber: 4,
      zoneName: "Window",
      teamLabel: "Blue",
      neighborDisplayNames: ["Student 2"],
    });

    const randomRow = snapshot.assigners.find(
      (row) => row.kind === "random" && row.assignerId === fixture.randomAssignerId,
    );
    expect(randomRow?.assignment).toMatchObject({
      item: "A",
      ranAt: 5000,
      runId: fixture.randomRunId,
    });

    const equitableRow = snapshot.assigners.find(
      (row) => row.kind === "equitable" && row.assignerId === fixture.equitableAssignerId,
    );
    expect(equitableRow?.assignment).toMatchObject({
      item: "Line leader",
      ranAt: 6000,
      runId: fixture.equitableRunId,
    });

    const emptyRow = snapshot.assigners.find(
      (row) => row.assignerId === fixture.emptyRandomAssignerId,
    );
    expect(emptyRow?.latestRunId).toBeNull();
    expect(emptyRow?.assignment).toBeNull();
  });

  it("does not expose another student's assignment to a student viewer", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const student = asStudent(test, fixture, 1);
    const studentUserId = fixture.studentIds[1]!;

    const snapshot = await student.query(api.dashboard.assignerSnapshotForAudience, {
      classId: fixture.classId,
      studentUserId,
    });

    const randomRow = snapshot.assigners.find((row) => row.assignerId === fixture.randomAssignerId);
    expect(randomRow?.assignment).toMatchObject({ item: "B" });
    expect(snapshot.seatCurrent).toBeNull();
  });

  it("allows a guardian to read a linked student's snapshot", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const guardian = asGuardian(test, fixture);

    const snapshot = await guardian.query(api.dashboard.assignerSnapshotForAudience, {
      classId: fixture.classId,
      studentUserId: fixture.studentIds[0]!,
    });

    expect(snapshot.assigners.some((row) => row.assignment?.item === "A")).toBe(true);
  });

  it("rejects a guardian for an unlinked student", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const guardian = asGuardian(test, fixture);

    await expect(
      guardian.query(api.dashboard.assignerSnapshotForAudience, {
        classId: fixture.classId,
        studentUserId: fixture.studentIds[1]!,
      }),
    ).rejects.toThrow();
  });
});
