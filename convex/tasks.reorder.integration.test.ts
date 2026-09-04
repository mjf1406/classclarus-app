import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { describe, expect, it } from "vite-plus/test";

import { api, internal } from "./_generated/api";
import { authz } from "./authz";
import { classScope } from "./lib/authzModel";
import { createConvexTest } from "./test.setup";

function createTest() {
  const test = createConvexTest();
  rateLimiterTest.register(test);
  return test;
}

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
      name: "Reorder Test",
      year: 2026,
      studentLanguage: "en",
      updatedAt: 1,
    });
    const studentId = await ctx.db.insert("users", {
      name: "Student 1",
      email: "student1@example.com",
    });
    const scope = classScope(classId);
    await authz.assignRole(ctx, ownerId, "owner", scope);
    await authz.assignRole(ctx, studentId, "student", scope);
    return { ownerId, classId, studentId };
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

describe("tasks.reorder", () => {
  it("reorders ungrouped tasks and assignment folders, then logs activity", async () => {
    const test = createTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);

    const firstId = await owner.mutation(api.tasks.create, {
      classId: fixture.classId,
      name: "First",
    });
    const secondId = await owner.mutation(api.tasks.create, {
      classId: fixture.classId,
      name: "Second",
    });
    const assignmentId = await owner.mutation(api.assignments.create, {
      classId: fixture.classId,
      name: "Lab",
      scoringMode: "total",
      totalPoints: 10,
      acceptLinkSubmissions: false,
      procedureSteps: [
        { key: "s1", body: "Warm up", addAsTask: true },
        { key: "s2", body: "Collect", addAsTask: true },
      ],
    });

    const before = await owner.query(api.tasks.list, { classId: fixture.classId });
    const folderTasks = before.filter((task) => task.assignmentId === assignmentId);
    expect(folderTasks).toHaveLength(2);
    expect(new Set(folderTasks.map((task) => task.sortOrder)).size).toBe(1);

    await owner.mutation(api.tasks.reorder, {
      classId: fixture.classId,
      items: [
        { type: "assignment", assignmentId },
        { type: "task", taskId: secondId },
        { type: "task", taskId: firstId },
      ],
    });

    const after = await owner.query(api.tasks.list, { classId: fixture.classId });
    const folderAfter = after.filter((task) => task.assignmentId === assignmentId);
    expect(folderAfter.map((task) => task.sortOrder)).toEqual([0, 0]);
    expect(folderAfter.map((task) => task.name).sort()).toEqual(["Collect", "Warm up"]);
    expect(after.find((task) => task._id === secondId)?.sortOrder).toBe(1);
    expect(after.find((task) => task._id === firstId)?.sortOrder).toBe(2);

    const activity = await test.run(async (ctx) => {
      return await ctx.db
        .query("classActivityEvents")
        .withIndex("by_class_resource_createdAt", (q) =>
          q.eq("classId", fixture.classId).eq("resourceType", "task"),
        )
        .collect();
    });
    expect(activity.map((event) => event.summaryKey)).toEqual(
      expect.arrayContaining(["activitySummary_reorderedTasks"]),
    );
  });

  it("rejects students and incomplete reorder lists", async () => {
    const test = createTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);
    const taskId = await owner.mutation(api.tasks.create, {
      classId: fixture.classId,
      name: "Solo",
    });

    await expect(
      asStudent(test, fixture).mutation(api.tasks.reorder, {
        classId: fixture.classId,
        items: [{ type: "task", taskId }],
      }),
    ).rejects.toThrow();

    await expect(
      owner.mutation(api.tasks.reorder, {
        classId: fixture.classId,
        items: [],
      }),
    ).rejects.toThrow(/exactly once/);
  });

  it("gives new procedure tasks the existing folder position", async () => {
    const test = createTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);
    const assignmentId = await owner.mutation(api.assignments.create, {
      classId: fixture.classId,
      name: "Lab",
      scoringMode: "total",
      totalPoints: 10,
      acceptLinkSubmissions: false,
      procedureSteps: [{ key: "s1", body: "Warm up", addAsTask: true }],
    });
    await owner.mutation(api.tasks.create, {
      classId: fixture.classId,
      name: "Later solo",
    });

    const listed = await owner.query(api.tasks.list, { classId: fixture.classId });
    const folderOrder = listed.find((task) => task.assignmentId === assignmentId)?.sortOrder;
    expect(folderOrder).toBe(0);

    await owner.mutation(api.assignments.update, {
      classId: fixture.classId,
      assignmentId,
      name: "Lab",
      scoringMode: "total",
      totalPoints: 10,
      acceptLinkSubmissions: false,
      procedureSteps: [
        {
          key: "s1",
          body: "Warm up",
          addAsTask: true,
          taskId: listed.find((task) => task.assignmentId === assignmentId)?._id,
        },
        { key: "s2", body: "Wrap up", addAsTask: true },
      ],
    });

    const after = await owner.query(api.tasks.list, { classId: fixture.classId });
    const folderTasks = after.filter((task) => task.assignmentId === assignmentId);
    expect(folderTasks).toHaveLength(2);
    expect(folderTasks.map((task) => task.sortOrder)).toEqual([0, 0]);
  });
});
