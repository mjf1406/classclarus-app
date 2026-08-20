import { describe, expect, it } from "vite-plus/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { authz } from "./authz";
import { classScope } from "./lib/authzModel";
import type { SeatLayoutItemSnapshot } from "./lib/seatChartGeometry";
import { createConvexTest } from "./test.setup";

async function seedFixture(test: ReturnType<typeof createConvexTest>) {
  await test.action(internal.authzBackfill.syncCatalogRoles, {});
  return await test.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      name: "Teacher",
      email: "layout-history-owner@example.com",
    });
    const classId = await ctx.db.insert("classes", {
      ownerId,
      name: "Layout student history",
      year: 2026,
      studentLanguage: "en",
      updatedAt: 1,
    });
    const groupId = await ctx.db.insert("groups", {
      classId,
      name: "Group",
      updatedAt: 1,
    });
    await ctx.db.insert("teams", {
      classId,
      groupId,
      name: "One",
      updatedAt: 1,
    });
    await ctx.db.insert("teams", {
      classId,
      groupId,
      name: "Two",
      updatedAt: 1,
    });
    const studentIds: Array<Id<"users">> = [];
    for (let index = 0; index < 2; index += 1) {
      const studentId = await ctx.db.insert("users", {
        name: `Student ${index + 1}`,
        email: `layout-history-student-${index}@example.com`,
      });
      studentIds.push(studentId);
      await ctx.db.insert("studentRosters", {
        classId,
        userId: studentId,
        rosterNumber: index + 1,
        firstName: `Student ${index + 1}`,
      });
      await ctx.db.insert("groupMemberships", {
        classId,
        groupId,
        studentUserId: studentId,
        updatedAt: 1,
      });
    }

    const items: SeatLayoutItemSnapshot[] = [
      {
        id: "desk-1",
        kind: "desk",
        label: "",
        deskNumber: 1,
        teamAssignment: { mode: "byName", teamName: "One" },
        zoneName: "Front",
        x: 0,
        y: 0,
        width: 40,
        height: 40,
      },
      {
        id: "desk-2",
        kind: "desk",
        label: "",
        deskNumber: 2,
        teamAssignment: { mode: "byName", teamName: "Two" },
        zoneName: "Back",
        x: 40,
        y: 0,
        width: 40,
        height: 40,
      },
    ];
    const layoutId = await ctx.db.insert("seatLayouts", {
      classId,
      name: "Two desks",
      canvasWidth: 500,
      canvasHeight: 500,
      nextDeskNumber: 3,
      items,
      genderParity: { mode: "off" },
      updatedAt: 1,
      createdBy: ownerId,
    });
    const chartId = await ctx.db.insert("seatCharts", {
      classId,
      layoutId,
      name: "Chart",
      assignments: [],
      updatedAt: 1,
      createdBy: ownerId,
    });

    const scope = classScope(classId);
    await authz.assignRole(ctx, ownerId, "owner", scope);
    for (const studentId of studentIds) {
      await authz.assignRole(ctx, studentId, "student", scope);
    }

    return {
      ownerId,
      classId,
      groupId,
      studentIds,
      items,
      layoutId,
      chartId,
    };
  });
}

describe("seatLayouts.studentHistory", () => {
  it("returns recorded timestamps filtered by dimension key", async () => {
    const test = createConvexTest();
    rateLimiterTest.register(test);
    const fixture = await seedFixture(test);
    const owner = test.withIdentity({
      subject: fixture.ownerId,
      email: "layout-history-owner@example.com",
      name: "Teacher",
    });

    await owner.mutation(api.seatCharts.recordSeating, {
      classId: fixture.classId,
      chartId: fixture.chartId,
      assignments: fixture.studentIds.map((studentUserId, index) => ({
        studentUserId,
        groupId: fixture.groupId,
        deskItemId: `desk-${index + 1}`,
      })),
    });

    const studentUserId = fixture.studentIds[0]!;
    const seatHistory = await owner.query(api.seatLayouts.studentHistory, {
      classId: fixture.classId,
      layoutId: fixture.layoutId,
      studentUserId,
      dimension: "seat",
      key: `${fixture.layoutId}:desk-1`,
    });
    expect(seatHistory.items).toHaveLength(1);
    expect(seatHistory.items[0]?.recordedAt).toBeGreaterThan(0);
    expect(seatHistory.nextBeforeRecordedAt).toBeUndefined();

    const otherSeat = await owner.query(api.seatLayouts.studentHistory, {
      classId: fixture.classId,
      layoutId: fixture.layoutId,
      studentUserId,
      dimension: "seat",
      key: `${fixture.layoutId}:desk-2`,
    });
    expect(otherSeat.items).toHaveLength(0);

    const zoneHistory = await owner.query(api.seatLayouts.studentHistory, {
      classId: fixture.classId,
      layoutId: fixture.layoutId,
      studentUserId,
      dimension: "zone",
      key: "Front",
    });
    expect(zoneHistory.items).toHaveLength(1);

    const teamHistory = await owner.query(api.seatLayouts.studentHistory, {
      classId: fixture.classId,
      layoutId: fixture.layoutId,
      studentUserId,
      dimension: "team",
      key: "name:One",
    });
    expect(teamHistory.items).toHaveLength(1);

    const neighborHistory = await owner.query(api.seatLayouts.studentHistory, {
      classId: fixture.classId,
      layoutId: fixture.layoutId,
      studentUserId,
      dimension: "neighbor",
      key: fixture.studentIds[1]!,
    });
    expect(neighborHistory.items).toHaveLength(1);
  });

  it("paginates occurrence timestamps", async () => {
    const test = createConvexTest();
    rateLimiterTest.register(test);
    const fixture = await seedFixture(test);
    const owner = test.withIdentity({
      subject: fixture.ownerId,
      email: "layout-history-owner@example.com",
      name: "Teacher",
    });
    const studentUserId = fixture.studentIds[0]!;

    await test.run(async (ctx) => {
      const recordId = await ctx.db.insert("seatChartRecords", {
        classId: fixture.classId,
        chartId: fixture.chartId,
        recordedAt: 3000,
        recordedBy: fixture.ownerId,
        chartName: "Chart",
        layoutId: fixture.layoutId,
        layoutName: "Two desks",
        canvasWidth: 500,
        canvasHeight: 500,
        layoutItems: fixture.items,
        placedCount: 1,
        seatedStudentIds: [studentUserId],
      });
      for (const recordedAt of [3000, 2000, 1000]) {
        await ctx.db.insert("seatChartPlacements", {
          classId: fixture.classId,
          chartId: fixture.chartId,
          layoutId: fixture.layoutId,
          recordId,
          studentUserId,
          studentDisplayName: "Student 1",
          groupId: fixture.groupId,
          deskItemId: "desk-1",
          deskNumber: 1,
          zoneName: "Front",
          teamKey: "name:One",
          teamLabel: "One",
          neighborStudentIds: [],
          neighborDisplayNames: [],
          combinationKey: `seat:${recordedAt}`,
          recordedAt,
        });
      }
    });

    const firstPage = await owner.query(api.seatLayouts.studentHistory, {
      classId: fixture.classId,
      layoutId: fixture.layoutId,
      studentUserId,
      dimension: "seat",
      key: `${fixture.layoutId}:desk-1`,
      limit: 2,
    });
    expect(firstPage.items.map((row) => row.recordedAt)).toEqual([3000, 2000]);
    expect(firstPage.nextBeforeRecordedAt).toBe(2000);

    const secondPage = await owner.query(api.seatLayouts.studentHistory, {
      classId: fixture.classId,
      layoutId: fixture.layoutId,
      studentUserId,
      dimension: "seat",
      key: `${fixture.layoutId}:desk-1`,
      limit: 2,
      beforeRecordedAt: firstPage.nextBeforeRecordedAt,
    });
    expect(secondPage.items.map((row) => row.recordedAt)).toEqual([1000]);
    expect(secondPage.nextBeforeRecordedAt).toBeUndefined();
  });

  it("rejects a student who lacks assigner management permission", async () => {
    const test = createConvexTest();
    rateLimiterTest.register(test);
    const fixture = await seedFixture(test);
    const student = test.withIdentity({
      subject: fixture.studentIds[0]!,
      email: "layout-history-student-0@example.com",
      name: "Student 1",
    });

    await expect(
      student.query(api.seatLayouts.studentHistory, {
        classId: fixture.classId,
        layoutId: fixture.layoutId,
        studentUserId: fixture.studentIds[0]!,
        dimension: "seat",
        key: `${fixture.layoutId}:desk-1`,
      }),
    ).rejects.toThrow();
  });
});
