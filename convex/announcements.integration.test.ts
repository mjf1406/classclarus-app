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
      name: "Announcements Test",
      year: 2026,
      studentLanguage: "en",
      updatedAt: 1,
    });
    const studentId = await ctx.db.insert("users", {
      name: "Student 1",
      email: "student1@example.com",
    });
    await ctx.db.insert("studentRosters", {
      classId,
      userId: studentId,
      rosterNumber: 1,
      firstName: "Student1",
    });

    const scope = classScope(classId);
    await authz.assignRole(ctx, ownerId, "owner", scope);
    await authz.assignRole(ctx, studentId, "student", scope);

    const announcementIds: Id<"announcements">[] = [];
    for (let index = 0; index < 7; index += 1) {
      const createdAt = 1000 + index;
      const announcementId = await ctx.db.insert("announcements", {
        classId,
        authorId: ownerId,
        title: `Announcement ${index + 1}`,
        bodyJson: JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] }),
        isPublic: false,
        attachmentFileIds: [],
        createdAt,
        updatedAt: createdAt,
      });
      announcementIds.push(announcementId);
    }

    return { ownerId, classId, studentId, announcementIds };
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

describe("announcements listRecent", () => {
  it("returns newest announcements first with a default limit of five", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const student = asStudent(test, fixture);

    const recent = await student.query(api.announcements.listRecent, {
      classId: fixture.classId,
    });

    expect(recent).toHaveLength(5);
    expect(recent.map((item) => item.title)).toEqual([
      "Announcement 7",
      "Announcement 6",
      "Announcement 5",
      "Announcement 4",
      "Announcement 3",
    ]);
    expect(recent[0]).toMatchObject({
      _id: fixture.announcementIds[6],
      createdAt: 1006,
      updatedAt: 1006,
    });
    expect(recent[0]).not.toHaveProperty("bodyJson");
  });

  it("respects a custom limit within bounds", async () => {
    const test = createConvexTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);

    const recent = await owner.query(api.announcements.listRecent, {
      classId: fixture.classId,
      limit: 2,
    });

    expect(recent).toHaveLength(2);
    expect(recent.map((item) => item.title)).toEqual(["Announcement 7", "Announcement 6"]);
  });
});
