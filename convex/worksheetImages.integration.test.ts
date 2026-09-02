import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { describe, expect, it } from "vite-plus/test";

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
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
    const otherOwnerId = await ctx.db.insert("users", {
      name: "Other Teacher",
      email: "other@example.com",
    });
    const classId = await ctx.db.insert("classes", {
      ownerId,
      name: "Worksheet Test",
      year: 2026,
      studentLanguage: "en",
      updatedAt: 1,
    });
    const otherClassId = await ctx.db.insert("classes", {
      ownerId: otherOwnerId,
      name: "Other Class",
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
    await authz.assignRole(ctx, otherOwnerId, "owner", classScope(otherClassId));

    return { ownerId, otherOwnerId, classId, otherClassId, studentId };
  });
}

async function insertClassFile(
  test: ReturnType<typeof createConvexTest>,
  args: {
    userId: Id<"users">;
    classId: Id<"classes">;
    name: string;
    preset: string;
  },
): Promise<Id<"files">> {
  return await test.run(async (ctx) => {
    const storageId = await ctx.storage.store(new Blob(["img"], { type: "image/png" }));
    return await ctx.db.insert("files", {
      storageId,
      userId: args.userId,
      classId: args.classId,
      name: args.name,
      contentType: "image/png",
      size: 3,
      preset: args.preset,
      createdAt: Date.now(),
    });
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

describe("worksheet images", () => {
  it("attaches, replaces, and deletes assignment worksheet images", async () => {
    const test = createTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);
    const firstId = await insertClassFile(test, {
      userId: fixture.ownerId,
      classId: fixture.classId,
      name: "assign-1.png",
      preset: "images",
    });
    const secondId = await insertClassFile(test, {
      userId: fixture.ownerId,
      classId: fixture.classId,
      name: "assign-2.png",
      preset: "images",
    });

    const assignmentId = await owner.mutation(api.assignments.create, {
      classId: fixture.classId,
      name: "Homework",
      scoringMode: "total",
      totalPoints: 10,
      acceptLinkSubmissions: true,
      worksheetImageFileId: firstId,
    });

    const listed = await asStudent(test, fixture).query(api.assignments.list, {
      classId: fixture.classId,
    });
    expect(listed[0]).toMatchObject({
      _id: assignmentId,
      worksheetImageFileId: firstId,
      worksheetImage: { fileId: firstId, name: "assign-1.png" },
    });

    await owner.mutation(api.assignments.update, {
      classId: fixture.classId,
      assignmentId,
      name: "Homework",
      scoringMode: "total",
      totalPoints: 10,
      acceptLinkSubmissions: true,
      worksheetImageFileId: secondId,
    });
    expect(await test.run((ctx) => ctx.db.get("files", firstId))).toBeNull();

    await owner.mutation(api.assignments.remove, {
      classId: fixture.classId,
      assignmentId,
    });
    expect(await test.run((ctx) => ctx.db.get("files", secondId))).toBeNull();
  });

  it("clears assignment refs when the file is deleted", async () => {
    const test = createTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);
    const fileId = await insertClassFile(test, {
      userId: fixture.ownerId,
      classId: fixture.classId,
      name: "shared.png",
      preset: "images",
    });

    const assignmentId = await owner.mutation(api.assignments.create, {
      classId: fixture.classId,
      name: "Has image",
      scoringMode: "total",
      totalPoints: 5,
      acceptLinkSubmissions: false,
      worksheetImageFileId: fileId,
    });

    await owner.mutation(api.files.deleteFile, { fileId });

    const assignment = await owner.query(api.assignments.get, {
      classId: fixture.classId,
      assignmentId,
    });
    expect(assignment?.worksheetImageFileId).toBeUndefined();
  });
});
