import { describe, expect, it } from "vite-plus/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { authz } from "./authz";
import { classScope } from "./lib/authzModel";
import type { SeatLayoutItemSnapshot } from "./lib/seatChartGeometry";
import { teamHistoryKey } from "./lib/seating/historyKeys";
import { prepareSeatingAlgorithmInput } from "./lib/seating/pipeline";
import { solveSeating } from "./lib/seating/solve";
import { createConvexTest } from "./test.setup";

async function seedFixture(test: ReturnType<typeof createConvexTest>) {
  await test.action(internal.authzBackfill.syncCatalogRoles, {});
  return await test.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      name: "Teacher",
      email: "seating-owner@example.com",
    });
    const classId = await ctx.db.insert("classes", {
      ownerId,
      name: "Seating history",
      year: 2026,
      studentLanguage: "en",
      updatedAt: 1,
    });
    const groupId = await ctx.db.insert("groups", {
      classId,
      name: "Group",
      updatedAt: 1,
    });
    const teamOne = await ctx.db.insert("teams", {
      classId,
      groupId,
      name: "One",
      updatedAt: 1,
    });
    const teamTwo = await ctx.db.insert("teams", {
      classId,
      groupId,
      name: "Two",
      updatedAt: 1,
    });
    const studentIds: Array<Id<"users">> = [];
    for (let index = 0; index < 2; index += 1) {
      const studentId = await ctx.db.insert("users", {
        name: `Student ${index + 1}`,
        email: `seating-student-${index}@example.com`,
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
      teamOne,
      teamTwo,
      studentIds,
      items,
      layoutId,
      chartId,
    };
  });
}

describe("seat layout algorithm history", () => {
  it("records canonical history and uses it on the next solve", async () => {
    const test = createConvexTest();
    rateLimiterTest.register(test);
    const fixture = await seedFixture(test);
    const owner = test.withIdentity({
      subject: fixture.ownerId,
      email: "seating-owner@example.com",
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
    const historyResult = await owner.query(api.seatLayouts.getAlgorithmHistory, {
      classId: fixture.classId,
      layoutId: fixture.layoutId,
      paginationOpts: { numItems: 200, cursor: null },
    });
    const rows = historyResult.page;
    expect(rows.filter((row) => row.dimension === "seat")).toHaveLength(2);
    expect(rows.filter((row) => row.dimension === "neighbor")).toHaveLength(2);
    expect(rows.some((row) => row.key === `${fixture.layoutId}:desk-1`)).toBe(true);
    expect(rows.some((row) => row.key === "name:One")).toBe(true);

    const input = prepareSeatingAlgorithmInput({
      layoutId: fixture.layoutId,
      layoutItems: fixture.items,
      lockedAssignments: [],
      scope: { kind: "class" },
      randomSeed: "second-run",
      genderParityMode: "off",
      constraints: [],
      memberships: fixture.studentIds.map((studentUserId) => ({
        studentUserId,
        groupId: fixture.groupId,
      })),
      rosterGenderByStudent: new Map(),
      layoutAggregateRows: rows,
      resolveTeamKey: (groupId, desk) => teamHistoryKey(groupId, desk.teamAssignment),
    });
    const result = solveSeating(input);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const deskByStudent = new Map(
      result.assignments.map((row) => [row.studentUserId, row.deskItemId]),
    );
    expect(deskByStudent.get(fixture.studentIds[0]!)).toBe("desk-2");
    expect(deskByStudent.get(fixture.studentIds[1]!)).toBe("desk-1");
  });

  it("rejects students who cannot manage assigners", async () => {
    const test = createConvexTest();
    rateLimiterTest.register(test);
    const fixture = await seedFixture(test);
    const student = test.withIdentity({
      subject: fixture.studentIds[0]!,
      email: "seating-student-0@example.com",
      name: "Student 1",
    });
    await expect(
      student.query(api.seatLayouts.getAlgorithmHistory, {
        classId: fixture.classId,
        layoutId: fixture.layoutId,
        paginationOpts: { numItems: 200, cursor: null },
      }),
    ).rejects.toThrow();
  });

  it("writes an activity event when seating is recorded", async () => {
    const test = createConvexTest();
    rateLimiterTest.register(test);
    const fixture = await seedFixture(test);
    const owner = test.withIdentity({
      subject: fixture.ownerId,
      email: "seating-owner@example.com",
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
    const activity = await test.run(async (ctx) => {
      return await ctx.db
        .query("classActivityEvents")
        .withIndex("by_class_resource_createdAt", (q) =>
          q.eq("classId", fixture.classId).eq("resourceType", "seatChart"),
        )
        .collect();
    });
    expect(activity.some((row) => row.summaryKey === "activitySummary_recordedSeatChart")).toBe(
      true,
    );
  });

  it("rejects recording an archived chart", async () => {
    const test = createConvexTest();
    rateLimiterTest.register(test);
    const fixture = await seedFixture(test);
    const owner = test.withIdentity({
      subject: fixture.ownerId,
      email: "seating-owner@example.com",
      name: "Teacher",
    });
    await test.run(async (ctx) => {
      await ctx.db.patch("seatCharts", fixture.chartId, { archivedAt: 2 });
    });
    await expect(
      owner.mutation(api.seatCharts.recordSeating, {
        classId: fixture.classId,
        chartId: fixture.chartId,
        assignments: [
          {
            studentUserId: fixture.studentIds[0]!,
            groupId: fixture.groupId,
            deskItemId: "desk-1",
          },
        ],
      }),
    ).rejects.toThrow(/Archived/);
  });

  it("rejects recording when a desk team name cannot be resolved", async () => {
    const test = createConvexTest();
    rateLimiterTest.register(test);
    const fixture = await seedFixture(test);
    const owner = test.withIdentity({
      subject: fixture.ownerId,
      email: "seating-owner@example.com",
      name: "Teacher",
    });
    await test.run(async (ctx) => {
      const layout = await ctx.db.get("seatLayouts", fixture.layoutId);
      if (!layout) throw new Error("missing layout");
      await ctx.db.patch("seatLayouts", fixture.layoutId, {
        items: layout.items.map((item, index) =>
          index === 0
            ? { ...item, teamAssignment: { mode: "byName" as const, teamName: "Ghosts" } }
            : item,
        ),
      });
    });
    await expect(
      owner.mutation(api.seatCharts.recordSeating, {
        classId: fixture.classId,
        chartId: fixture.chartId,
        assignments: [
          {
            studentUserId: fixture.studentIds[0]!,
            groupId: fixture.groupId,
            deskItemId: "desk-1",
          },
        ],
      }),
    ).rejects.toThrow(/Ghosts/);
  });

  it("previews zone violations and clears them after a constrained solve", async () => {
    const test = createConvexTest();
    rateLimiterTest.register(test);
    const fixture = await seedFixture(test);
    const owner = test.withIdentity({
      subject: fixture.ownerId,
      email: "seating-owner@example.com",
      name: "Teacher",
    });
    await test.run(async (ctx) => {
      await ctx.db.insert("seatConstraints", {
        classId: fixture.classId,
        type: "zone",
        polarity: "must",
        studentUserId: fixture.studentIds[0]!,
        zoneName: "Back",
        createdBy: fixture.ownerId,
        updatedAt: 1,
      });
    });
    const violated = await owner.query(api.seatCharts.previewViolations, {
      classId: fixture.classId,
      chartId: fixture.chartId,
      assignments: [
        {
          studentUserId: fixture.studentIds[0]!,
          groupId: fixture.groupId,
          deskItemId: "desk-1",
        },
        {
          studentUserId: fixture.studentIds[1]!,
          groupId: fixture.groupId,
          deskItemId: "desk-2",
        },
      ],
    });
    expect(violated.some((row) => row.type === "zone")).toBe(true);

    const historyResult = await owner.query(api.seatLayouts.getAlgorithmHistory, {
      classId: fixture.classId,
      layoutId: fixture.layoutId,
      paginationOpts: { numItems: 200, cursor: null },
    });
    const input = prepareSeatingAlgorithmInput({
      layoutId: fixture.layoutId,
      layoutItems: fixture.items,
      lockedAssignments: [],
      scope: { kind: "class" },
      randomSeed: "constrained",
      genderParityMode: "off",
      constraints: [
        {
          _id: "constraint-zone" as Id<"seatConstraints">,
          type: "zone",
          polarity: "must",
          studentUserId: fixture.studentIds[0]!,
          zoneName: "Back",
        },
      ],
      memberships: fixture.studentIds.map((studentUserId) => ({
        studentUserId,
        groupId: fixture.groupId,
      })),
      rosterGenderByStudent: new Map(),
      layoutAggregateRows: historyResult.page,
      resolveTeamKey: (groupId, desk) => teamHistoryKey(groupId, desk.teamAssignment),
    });
    const result = solveSeating(input);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const preview = await owner.query(api.seatCharts.previewViolations, {
      classId: fixture.classId,
      chartId: fixture.chartId,
      assignments: [...result.assignments],
    });
    expect(preview).toEqual([]);
  });

  it("paginates algorithm history beyond a single 200-row page", async () => {
    const test = createConvexTest();
    rateLimiterTest.register(test);
    const fixture = await seedFixture(test);
    const owner = test.withIdentity({
      subject: fixture.ownerId,
      email: "seating-owner@example.com",
      name: "Teacher",
    });
    await test.run(async (ctx) => {
      for (let index = 0; index < 210; index += 1) {
        await ctx.db.insert("seatLayoutAggregates", {
          classId: fixture.classId,
          layoutId: fixture.layoutId,
          studentUserId: fixture.studentIds[0]!,
          dimension: "seat",
          key: `extra:${index}`,
          label: `Seat extra ${index}`,
          count: 1,
          updatedAt: 1,
        });
      }
    });
    const first = await owner.query(api.seatLayouts.getAlgorithmHistory, {
      classId: fixture.classId,
      layoutId: fixture.layoutId,
      paginationOpts: { numItems: 200, cursor: null },
    });
    expect(first.isDone).toBe(false);
    expect(first.page).toHaveLength(200);
    const second = await owner.query(api.seatLayouts.getAlgorithmHistory, {
      classId: fixture.classId,
      layoutId: fixture.layoutId,
      paginationOpts: { numItems: 200, cursor: first.continueCursor },
    });
    expect(second.page.length).toBeGreaterThan(0);
  });
});
