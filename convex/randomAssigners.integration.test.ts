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
      name: "Random Test",
      year: 2026,
      studentLanguage: "en",
      updatedAt: 1,
    });
    const studentIds: Id<"users">[] = [];
    for (let index = 0; index < 4; index += 1) {
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

    const scope = classScope(classId);
    await authz.assignRole(ctx, ownerId, "owner", scope);
    for (const studentId of studentIds) {
      await authz.assignRole(ctx, studentId, "student", scope);
    }

    const assignerId = await ctx.db.insert("randomAssigners", {
      classId,
      name: "Chromebooks",
      items: ["A", "B", "C", "D"],
      defaultReplicates: false,
      defaultScope: "class",
      createdBy: ownerId,
      createdAt: 1,
      updatedAt: 1,
    });

    return { ownerId, classId, studentIds, assignerId };
  });
}

function asOwner(test: ReturnType<typeof createConvexTest>, fixture: Fixture) {
  return test.withIdentity({
    subject: fixture.ownerId,
    email: "teacher@example.com",
    name: "Teacher",
  });
}

describe("random assigner data tab", () => {
  it("counts assignments after a run and zeros them after removeRun", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);

    const runId = await owner.mutation(api.randomAssigners.run, {
      classId: fixture.classId,
      assignerId: fixture.assignerId,
      scope: "class",
      replicates: false,
    });

    const before = await owner.query(api.randomAssigners.rosterMatrix, {
      classId: fixture.classId,
      assignerId: fixture.assignerId,
    });
    expect(before.items).toEqual(["A", "B", "C", "D"]);
    expect(before.students).toHaveLength(4);
    expect(
      before.countsByStudent.flatMap((row) => row.counts).reduce((sum, row) => sum + row.count, 0),
    ).toBe(4);

    const run = await owner.query(api.randomAssigners.getRun, {
      classId: fixture.classId,
      assignerId: fixture.assignerId,
      runId,
    });
    const sample = run.assignments[0]!;
    const history = await owner.query(api.randomAssigners.studentHistory, {
      classId: fixture.classId,
      assignerId: fixture.assignerId,
      studentUserId: sample.studentUserId,
      item: sample.item,
      limit: 10,
    });
    expect(history.items.some((row) => row.runId === runId)).toBe(true);

    await owner.mutation(api.randomAssigners.removeRun, {
      classId: fixture.classId,
      assignerId: fixture.assignerId,
      runId,
    });
    const afterRemoval = await owner.query(api.randomAssigners.rosterMatrix, {
      classId: fixture.classId,
      assignerId: fixture.assignerId,
    });
    expect(
      afterRemoval.countsByStudent
        .flatMap((row) => row.counts)
        .reduce((sum, row) => sum + row.count, 0),
    ).toBe(0);
  });

  it("rejects a student who lacks assigner management permission", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const student = test.withIdentity({
      subject: fixture.studentIds[0]!,
      email: "student1@example.com",
    });

    await expect(
      student.query(api.randomAssigners.rosterMatrix, {
        classId: fixture.classId,
        assignerId: fixture.assignerId,
      }),
    ).rejects.toThrow();

    await expect(
      student.query(api.randomAssigners.studentHistory, {
        classId: fixture.classId,
        assignerId: fixture.assignerId,
        studentUserId: fixture.studentIds[0]!,
        item: "A",
      }),
    ).rejects.toThrow();
  });
});
