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
      name: "Attachment Test",
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
    contentType?: string;
  },
): Promise<Id<"files">> {
  return await test.run(async (ctx) => {
    const contentType =
      args.contentType ?? (args.preset === "documents" ? "application/pdf" : "image/png");
    const storageId = await ctx.storage.store(new Blob(["file"], { type: contentType }));
    return await ctx.db.insert("files", {
      storageId,
      userId: args.userId,
      classId: args.classId,
      name: args.name,
      contentType,
      size: 4,
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

describe("task attachments", () => {
  it("attaches mixed images and documents and returns them on list and get", async () => {
    const test = createTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);
    const imageId = await insertClassFile(test, {
      userId: fixture.ownerId,
      classId: fixture.classId,
      name: "sheet.png",
      preset: "images",
    });
    const pdfId = await insertClassFile(test, {
      userId: fixture.ownerId,
      classId: fixture.classId,
      name: "notes.pdf",
      preset: "documents",
      contentType: "application/pdf",
    });

    const taskId = await owner.mutation(api.tasks.create, {
      classId: fixture.classId,
      name: "Do the sheet",
      attachmentFileIds: [imageId, pdfId, imageId],
    });

    const listed = await asStudent(test, fixture).query(api.tasks.list, {
      classId: fixture.classId,
    });
    expect(listed[0]).toMatchObject({
      _id: taskId,
      attachmentFileIds: [imageId, pdfId],
      attachments: [
        { fileId: imageId, name: "sheet.png", preset: "images" },
        { fileId: pdfId, name: "notes.pdf", preset: "documents" },
      ],
    });

    const detail = await owner.query(api.tasks.get, {
      classId: fixture.classId,
      taskId,
    });
    expect(detail?.attachmentFileIds).toEqual([imageId, pdfId]);
    expect(detail?.attachments).toHaveLength(2);
  });

  it("rejects a wrong-class or audio file on create", async () => {
    const test = createTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);
    const audioId = await insertClassFile(test, {
      userId: fixture.ownerId,
      classId: fixture.classId,
      name: "bell.mp3",
      preset: "audio",
      contentType: "audio/mpeg",
    });
    const otherClassFileId = await insertClassFile(test, {
      userId: fixture.otherOwnerId,
      classId: fixture.otherClassId,
      name: "other.png",
      preset: "images",
    });

    await expect(
      owner.mutation(api.tasks.create, {
        classId: fixture.classId,
        name: "Bad audio",
        attachmentFileIds: [audioId],
      }),
    ).rejects.toThrow("Attachments must be images or documents");

    await expect(
      owner.mutation(api.tasks.create, {
        classId: fixture.classId,
        name: "Bad class",
        attachmentFileIds: [otherClassFileId],
      }),
    ).rejects.toThrow("File not found or access denied");
  });

  it("rejects more than five attachments", async () => {
    const test = createTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);
    const fileIds: Array<Id<"files">> = [];
    for (let i = 0; i < 6; i += 1) {
      fileIds.push(
        await insertClassFile(test, {
          userId: fixture.ownerId,
          classId: fixture.classId,
          name: `file-${i}.png`,
          preset: "images",
        }),
      );
    }

    await expect(
      owner.mutation(api.tasks.create, {
        classId: fixture.classId,
        name: "Too many",
        attachmentFileIds: fileIds,
      }),
    ).rejects.toThrow("At most 5 attachments allowed");
  });

  it("updates and removes attachments without deleting the files", async () => {
    const test = createTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);
    const firstId = await insertClassFile(test, {
      userId: fixture.ownerId,
      classId: fixture.classId,
      name: "first.png",
      preset: "images",
    });
    const secondId = await insertClassFile(test, {
      userId: fixture.ownerId,
      classId: fixture.classId,
      name: "second.pdf",
      preset: "documents",
      contentType: "application/pdf",
    });

    const taskId = await owner.mutation(api.tasks.create, {
      classId: fixture.classId,
      name: "Replace me",
      attachmentFileIds: [firstId],
    });

    await owner.mutation(api.tasks.update, {
      classId: fixture.classId,
      taskId,
      name: "Replace me",
      attachmentFileIds: [secondId],
    });

    expect(await test.run((ctx) => ctx.db.get("files", firstId))).not.toBeNull();
    expect(await test.run((ctx) => ctx.db.get("files", secondId))).not.toBeNull();

    await owner.mutation(api.tasks.update, {
      classId: fixture.classId,
      taskId,
      name: "Replace me",
      attachmentFileIds: [],
    });

    const cleared = await owner.query(api.tasks.get, {
      classId: fixture.classId,
      taskId,
    });
    expect(cleared?.attachmentFileIds).toEqual([]);
    expect(await test.run((ctx) => ctx.db.get("files", secondId))).not.toBeNull();
  });

  it("keeps attachment files when the task is removed", async () => {
    const test = createTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);
    const fileId = await insertClassFile(test, {
      userId: fixture.ownerId,
      classId: fixture.classId,
      name: "keep.png",
      preset: "images",
    });

    const taskId = await owner.mutation(api.tasks.create, {
      classId: fixture.classId,
      name: "Delete me",
      attachmentFileIds: [fileId],
    });
    await owner.mutation(api.tasks.remove, {
      classId: fixture.classId,
      taskId,
    });

    expect(await test.run((ctx) => ctx.db.get("files", fileId))).not.toBeNull();
  });

  it("returns a legacy worksheet image as an attachment before migration", async () => {
    const test = createTest();
    const fixture = await seedFixture(test);
    const fileId = await insertClassFile(test, {
      userId: fixture.ownerId,
      classId: fixture.classId,
      name: "legacy.png",
      preset: "images",
    });
    const taskId = await test.run(async (ctx) => {
      const now = Date.now();
      return await ctx.db.insert("tasks", {
        classId: fixture.classId,
        name: "Legacy image",
        worksheetImageFileId: fileId,
        createdBy: fixture.ownerId,
        createdAt: now,
        updatedAt: now,
      });
    });

    const detail = await asOwner(test, fixture).query(api.tasks.get, {
      classId: fixture.classId,
      taskId,
    });
    expect(detail?.attachmentFileIds).toEqual([fileId]);
    expect(detail?.attachments[0]).toMatchObject({ fileId, name: "legacy.png" });
  });

  it("clears task attachment refs when the file is deleted", async () => {
    const test = createTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);
    const fileId = await insertClassFile(test, {
      userId: fixture.ownerId,
      classId: fixture.classId,
      name: "shared.png",
      preset: "images",
    });

    const taskId = await owner.mutation(api.tasks.create, {
      classId: fixture.classId,
      name: "Has file",
      attachmentFileIds: [fileId],
    });

    await owner.mutation(api.files.deleteFile, { fileId });

    const task = await owner.query(api.tasks.get, { classId: fixture.classId, taskId });
    expect(task?.attachmentFileIds).toEqual([]);
    expect(task?.attachments).toEqual([]);
  });
});
