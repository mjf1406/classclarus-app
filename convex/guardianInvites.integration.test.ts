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

const DAY_MS = 24 * 60 * 60 * 1000;

async function seedFixture(test: ReturnType<typeof createConvexTest>) {
  await test.action(internal.authzBackfill.syncCatalogRoles, {});
  return await test.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      name: "Teacher",
      email: "teacher@example.com",
    });
    const classId = await ctx.db.insert("classes", {
      ownerId,
      name: "Guardian Invites Test",
      year: 2026,
      studentLanguage: "en",
      updatedAt: 1,
    });

    const studentIds: Id<"users">[] = [];
    for (let index = 0; index < 2; index += 1) {
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
    const outsiderId = await ctx.db.insert("users", {
      name: "Outsider",
      email: "outsider@example.com",
    });

    const scope = classScope(classId);
    await authz.assignRole(ctx, ownerId, "owner", scope);
    for (const studentId of studentIds) {
      await authz.assignRole(ctx, studentId, "student", scope);
    }
    await authz.assignRole(ctx, guardianId, "guardian", scope);

    return {
      ownerId,
      classId,
      studentIds,
      guardianId,
      outsiderId,
    };
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
    subject: fixture.studentIds[0]!,
    email: "student1@example.com",
    name: "Student 1",
  });
}

function asGuardian(test: ReturnType<typeof createConvexTest>, fixture: Fixture) {
  return test.withIdentity({
    subject: fixture.guardianId,
    email: "guardian@example.com",
    name: "Guardian",
  });
}

function asUser(
  test: ReturnType<typeof createConvexTest>,
  userId: Id<"users">,
  email: string,
  name: string,
) {
  return test.withIdentity({ subject: userId, email, name });
}

function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data?: { code?: string } }).data;
    if (typeof data?.code === "string") return data.code;
  }
  return undefined;
}

async function expectErrorCode(fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
    throw new Error(`Expected ${code}`);
  } catch (error) {
    if (error instanceof Error && error.message === `Expected ${code}`) {
      throw error;
    }
    expect(errorCode(error)).toBe(code);
  }
}

describe("guardian invite codes", () => {
  it("creates one code per student and lists the student name", async () => {
    const test = createTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);

    const created = await owner.mutation(api.joinCodes.createGuardianInvites, {
      classId: fixture.classId,
      studentUserIds: fixture.studentIds,
      ttlMs: 7 * DAY_MS,
      maxUses: 2,
    });

    expect(created).toHaveLength(2);
    expect(created[0]?.code).toHaveLength(6);
    expect(created[0]?.studentUserId).toBe(fixture.studentIds[0]);
    expect(created[0]?.studentDisplayName).toBe("Student1");

    const listed = await owner.query(api.joinCodes.listForClass, {
      classId: fixture.classId,
    });
    expect(listed.some((code) => code.studentUserId === fixture.studentIds[0])).toBe(true);
    expect(
      listed.find((code) => code.studentUserId === fixture.studentIds[0])?.studentDisplayName,
    ).toBe("Student1");
  });

  it("rejects TTL over 7 days and non-student targets", async () => {
    const test = createTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);

    await expect(
      owner.mutation(api.joinCodes.createGuardianInvites, {
        classId: fixture.classId,
        studentUserIds: fixture.studentIds,
        ttlMs: 8 * DAY_MS,
        maxUses: 2,
      }),
    ).rejects.toThrow(/7 days/);

    await expect(
      owner.mutation(api.joinCodes.createGuardianInvites, {
        classId: fixture.classId,
        studentUserIds: [fixture.ownerId],
        ttlMs: DAY_MS,
        maxUses: 2,
      }),
    ).rejects.toThrow(/current student/);
  });

  it("denies create without invite permission", async () => {
    const test = createTest();
    const fixture = await seedFixture(test);
    const student = asStudent(test, fixture);

    await expect(
      student.mutation(api.joinCodes.createGuardianInvites, {
        classId: fixture.classId,
        studentUserIds: fixture.studentIds,
        ttlMs: DAY_MS,
        maxUses: 2,
      }),
    ).rejects.toThrow();
  });

  it("redeems as a new user by joining and linking", async () => {
    const test = createTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);
    const created = await owner.mutation(api.joinCodes.createGuardianInvites, {
      classId: fixture.classId,
      studentUserIds: [fixture.studentIds[0]!],
      ttlMs: DAY_MS,
      maxUses: 2,
    });

    const outsider = asUser(test, fixture.outsiderId, "outsider@example.com", "Outsider");
    const result = await outsider.mutation(api.joinCodes.redeem, { code: created[0]!.code });
    expect(result).toEqual({ classId: fixture.classId, role: "guardian" });

    const role = await test.run(async (ctx) => {
      const entries = await authz.getUserRoles(
        ctx,
        fixture.outsiderId,
        classScope(fixture.classId),
      );
      return entries.map((entry: { role: string }) => entry.role);
    });
    expect(role).toContain("guardian");

    const links = await test.run(async (ctx) => {
      return await ctx.db
        .query("guardianStudentLinks")
        .withIndex("by_class_guardian_student", (q) =>
          q
            .eq("classId", fixture.classId)
            .eq("guardianUserId", fixture.outsiderId)
            .eq("studentUserId", fixture.studentIds[0]!),
        )
        .unique();
    });
    expect(links).not.toBeNull();
  });

  it("lets an existing guardian link only", async () => {
    const test = createTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);
    const created = await owner.mutation(api.joinCodes.createGuardianInvites, {
      classId: fixture.classId,
      studentUserIds: [fixture.studentIds[1]!],
      ttlMs: DAY_MS,
      maxUses: 2,
    });

    const guardian = asGuardian(test, fixture);
    const result = await guardian.mutation(api.joinCodes.redeem, { code: created[0]!.code });
    expect(result.role).toBe("guardian");

    const link = await test.run(async (ctx) => {
      return await ctx.db
        .query("guardianStudentLinks")
        .withIndex("by_class_guardian_student", (q) =>
          q
            .eq("classId", fixture.classId)
            .eq("guardianUserId", fixture.guardianId)
            .eq("studentUserId", fixture.studentIds[1]!),
        )
        .unique();
    });
    expect(link).not.toBeNull();
  });

  it("rejects already-linked guardians and a 6th guardian", async () => {
    const test = createTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);
    const studentId = fixture.studentIds[0]!;

    await test.run(async (ctx) => {
      for (let index = 0; index < 5; index += 1) {
        const guardianId = await ctx.db.insert("users", {
          name: `Cap Guardian ${index}`,
          email: `cap${index}@example.com`,
        });
        await authz.assignRole(ctx, guardianId, "guardian", classScope(fixture.classId));
        await ctx.db.insert("guardianStudentLinks", {
          classId: fixture.classId,
          guardianUserId: guardianId,
          studentUserId: studentId,
          createdAt: 1,
          createdBy: fixture.ownerId,
        });
      }
    });

    const created = await owner.mutation(api.joinCodes.createGuardianInvites, {
      classId: fixture.classId,
      studentUserIds: [studentId],
      ttlMs: DAY_MS,
      maxUses: 5,
    });

    await expectErrorCode(
      () =>
        asUser(test, fixture.outsiderId, "outsider@example.com", "Outsider").mutation(
          api.joinCodes.redeem,
          { code: created[0]!.code },
        ),
      "GUARDIAN_LIMIT_REACHED",
    );

    const second = await owner.mutation(api.joinCodes.createGuardianInvites, {
      classId: fixture.classId,
      studentUserIds: [fixture.studentIds[1]!],
      ttlMs: DAY_MS,
      maxUses: 2,
    });
    const guardian = asGuardian(test, fixture);
    await guardian.mutation(api.joinCodes.redeem, { code: second[0]!.code });
    await expectErrorCode(
      () => guardian.mutation(api.joinCodes.redeem, { code: second[0]!.code }),
      "ALREADY_LINKED",
    );
  });

  it("treats a code for a removed student as invalid and deletes pending codes", async () => {
    const test = createTest();
    const fixture = await seedFixture(test);
    const owner = asOwner(test, fixture);
    const studentId = fixture.studentIds[0]!;
    const created = await owner.mutation(api.joinCodes.createGuardianInvites, {
      classId: fixture.classId,
      studentUserIds: [studentId],
      ttlMs: DAY_MS,
      maxUses: 2,
    });

    await owner.mutation(api.members.remove, {
      classId: fixture.classId,
      userId: studentId,
    });

    const listed = await owner.query(api.joinCodes.listForClass, { classId: fixture.classId });
    expect(listed.some((code) => code.studentUserId === studentId)).toBe(false);

    await expectErrorCode(
      () =>
        asUser(test, fixture.outsiderId, "outsider@example.com", "Outsider").mutation(
          api.joinCodes.redeem,
          { code: created[0]!.code },
        ),
      "INVALID_JOIN_CODE",
    );
  });
});
