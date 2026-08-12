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
      name: "Fairness Test",
      year: 2026,
      studentLanguage: "en",
      updatedAt: 1,
    });
    const groupA = await ctx.db.insert("groups", {
      classId,
      name: "Group A",
      updatedAt: 1,
    });
    const groupB = await ctx.db.insert("groups", {
      classId,
      name: "Group B",
      updatedAt: 1,
    });
    const studentIds: Id<"users">[] = [];
    for (let index = 0; index < 5; index += 1) {
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
        gender: index % 2 === 0 ? "male" : "female",
      });
    }

    const scope = classScope(classId);
    await authz.assignRole(ctx, ownerId, "owner", scope);
    for (const studentId of studentIds) {
      await authz.assignRole(ctx, studentId, "student", scope);
    }

    await ctx.db.insert("groupMemberships", {
      classId,
      groupId: groupA,
      studentUserId: studentIds[0]!,
      updatedAt: 1,
    });
    await ctx.db.insert("groupMemberships", {
      classId,
      groupId: groupA,
      studentUserId: studentIds[1]!,
      updatedAt: 1,
    });
    await ctx.db.insert("groupMemberships", {
      classId,
      groupId: groupB,
      studentUserId: studentIds[2]!,
      updatedAt: 1,
    });
    await ctx.db.insert("groupMemberships", {
      classId,
      groupId: groupB,
      studentUserId: studentIds[3]!,
      updatedAt: 1,
    });

    const assignerId = await ctx.db.insert("equitableAssigners", {
      classId,
      name: "Class Jobs",
      items: ["A", "B"],
      defaultBalanceGender: false,
      defaultScope: "groups",
      defaultGenderBuckets: ["m", "f", "other"],
      createdBy: ownerId,
      createdAt: 1,
      updatedAt: 1,
    });

    return { ownerId, classId, groupA, groupB, studentIds, assignerId };
  });
}

function asOwner(test: ReturnType<typeof createConvexTest>, fixture: Fixture) {
  return test.withIdentity({
    subject: fixture.ownerId,
    email: "teacher@example.com",
    name: "Teacher",
  });
}

describe("equitable assigner production flow", () => {
  it("assembles grouped recipients, persists snapshots, and excludes ungrouped students", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);

    const runId = await owner.mutation(api.equitableAssigners.run, {
      classId: fixture.classId,
      assignerId: fixture.assignerId,
      scope: "groups",
      balanceGender: false,
    });
    const run = await owner.query(api.equitableAssigners.getRun, {
      classId: fixture.classId,
      assignerId: fixture.assignerId,
      runId,
    });

    expect(run.itemsSnapshot).toEqual(["A", "B"]);
    expect(run.assignments).toHaveLength(4);
    expect(new Set(run.assignments.map((row) => row.studentUserId)).size).toBe(4);
    expect(run.assignments.some((row) => row.studentUserId === fixture.studentIds[4])).toBe(false);
    expect(
      run.assignments.every(
        (row) => row.groupId === fixture.groupA || row.groupId === fixture.groupB,
      ),
    ).toBe(true);

    const matrix = await owner.query(api.equitableAssigners.rosterMatrix, {
      classId: fixture.classId,
      assignerId: fixture.assignerId,
    });
    const ungroupedCounts = matrix.countsByStudent.find(
      (row) => row.studentUserId === fixture.studentIds[4],
    );
    expect(ungroupedCounts?.counts.every((entry) => entry.count === 0)).toBe(true);

    const activity = await test.run(async (ctx) => {
      return await ctx.db
        .query("classActivityEvents")
        .withIndex("by_class_resource_createdAt", (q) =>
          q.eq("classId", fixture.classId).eq("resourceType", "equitableAssigner"),
        )
        .collect();
    });
    expect(activity.some((event) => event.resourceId === runId)).toBe(true);
  });

  it("uses persisted global history after a student changes groups", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);
    const mover = fixture.studentIds[0]!;
    const veteran = fixture.studentIds[1]!;
    const newer = fixture.studentIds[2]!;

    await test.run(async (ctx) => {
      const memberships = await ctx.db
        .query("groupMemberships")
        .withIndex("by_class", (q) => q.eq("classId", fixture.classId))
        .collect();
      for (const membership of memberships) {
        if (membership.studentUserId === mover) {
          await ctx.db.patch("groupMemberships", membership._id, { groupId: fixture.groupB });
        }
      }
      await ctx.db.insert("equitableAssignerRuns", {
        classId: fixture.classId,
        assignerId: fixture.assignerId,
        ranAt: 10,
        ranBy: fixture.ownerId,
        scope: "groups",
        balanceGender: false,
        genderBuckets: ["m", "f", "other"],
        itemsSnapshot: ["A", "B"],
        assignments: [
          {
            studentUserId: mover,
            studentDisplayName: "Mover",
            item: "A",
            groupId: fixture.groupA,
            groupName: "Group A",
          },
          {
            studentUserId: veteran,
            studentDisplayName: "Veteran",
            item: "A",
            groupId: fixture.groupA,
            groupName: "Group A",
          },
        ],
      });
      await ctx.db.insert("equitableAssignerRuns", {
        classId: fixture.classId,
        assignerId: fixture.assignerId,
        ranAt: 11,
        ranBy: fixture.ownerId,
        scope: "groups",
        balanceGender: false,
        genderBuckets: ["m", "f", "other"],
        itemsSnapshot: ["A", "B"],
        assignments: [
          {
            studentUserId: mover,
            studentDisplayName: "Mover",
            item: "B",
            groupId: fixture.groupA,
            groupName: "Group A",
          },
        ],
      });
    });

    const runId = await owner.mutation(api.equitableAssigners.run, {
      classId: fixture.classId,
      assignerId: fixture.assignerId,
      scope: "groups",
      balanceGender: false,
    });
    const run = await owner.query(api.equitableAssigners.getRun, {
      classId: fixture.classId,
      assignerId: fixture.assignerId,
      runId,
    });
    const groupBAssignees = run.assignments
      .filter((row) => row.groupId === fixture.groupB)
      .map((row) => row.studentUserId);

    expect(groupBAssignees).toContain(newer);
    expect(groupBAssignees).not.toContain(mover);
  });

  it("removing a run removes its counts from history and later persisted runs restore them", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);
    const runId = await owner.mutation(api.equitableAssigners.run, {
      classId: fixture.classId,
      assignerId: fixture.assignerId,
      scope: "class",
      balanceGender: false,
    });

    const before = await owner.query(api.equitableAssigners.rosterMatrix, {
      classId: fixture.classId,
      assignerId: fixture.assignerId,
    });
    expect(
      before.countsByStudent.flatMap((row) => row.counts).reduce((sum, row) => sum + row.count, 0),
    ).toBeGreaterThan(0);

    await owner.mutation(api.equitableAssigners.removeRun, {
      classId: fixture.classId,
      assignerId: fixture.assignerId,
      runId,
    });
    const afterRemoval = await owner.query(api.equitableAssigners.rosterMatrix, {
      classId: fixture.classId,
      assignerId: fixture.assignerId,
    });
    expect(
      afterRemoval.countsByStudent
        .flatMap((row) => row.counts)
        .reduce((sum, row) => sum + row.count, 0),
    ).toBe(0);

    const rerunId = await owner.mutation(api.equitableAssigners.run, {
      classId: fixture.classId,
      assignerId: fixture.assignerId,
      scope: "class",
      balanceGender: true,
      genderBuckets: ["m", "f"],
    });
    const afterRerun = await owner.query(api.equitableAssigners.rosterMatrix, {
      classId: fixture.classId,
      assignerId: fixture.assignerId,
    });
    expect(
      afterRerun.countsByStudent
        .flatMap((row) => row.counts)
        .reduce((sum, row) => sum + row.count, 0),
    ).toBeGreaterThan(0);

    const rerun = await owner.query(api.equitableAssigners.getRun, {
      classId: fixture.classId,
      assignerId: fixture.assignerId,
      runId: rerunId,
    });
    const maleIds = new Set([fixture.studentIds[0], fixture.studentIds[2], fixture.studentIds[4]]);
    const femaleIds = new Set([fixture.studentIds[1], fixture.studentIds[3]]);
    expect(rerun.assignments.filter((row) => maleIds.has(row.studentUserId)).length).toBe(2);
    expect(rerun.assignments.filter((row) => femaleIds.has(row.studentUserId)).length).toBe(2);

    const sample = rerun.assignments[0]!;
    const history = await owner.query(api.equitableAssigners.studentHistory, {
      classId: fixture.classId,
      assignerId: fixture.assignerId,
      studentUserId: sample.studentUserId,
      item: sample.item,
      limit: 10,
    });
    expect(history.items.some((row) => row.runId === rerunId)).toBe(true);
  });

  it("rejects a student who lacks assigner management permission", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const student = test.withIdentity({
      subject: fixture.studentIds[0]!,
      email: "student1@example.com",
    });

    await expect(
      student.mutation(api.equitableAssigners.run, {
        classId: fixture.classId,
        assignerId: fixture.assignerId,
        scope: "class",
        balanceGender: false,
      }),
    ).rejects.toThrow();
  });
});
