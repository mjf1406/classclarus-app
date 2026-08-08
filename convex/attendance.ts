import { v } from "convex/values";

import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx } from "./_generated/server.js";
import { classScope } from "./lib/authzModel.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import { getClassRoleForUser } from "./lib/guardianLinks.js";
import { rateLimiter } from "./lib/rateLimiter.js";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const attendanceStatusValidator = v.union(
  v.literal("present"),
  v.literal("absent"),
  v.literal("late"),
);

const attendanceSessionValidator = v.object({
  _id: v.id("attendanceSessions"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  dateKey: v.string(),
  takenBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const attendanceRecordValidator = v.object({
  _id: v.id("attendanceRecords"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  sessionId: v.id("attendanceSessions"),
  dateKey: v.string(),
  studentUserId: v.id("users"),
  status: attendanceStatusValidator,
  updatedAt: v.number(),
  updatedBy: v.id("users"),
});

function assertValidDateKey(dateKey: string): void {
  if (!DATE_KEY_RE.test(dateKey)) {
    throw new Error("Invalid date key");
  }
}

async function requireStudentInClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
  studentUserId: Id<"users">,
): Promise<void> {
  const role = await getClassRoleForUser(ctx, studentUserId, classScope(classId));
  if (role !== "student") {
    throw new Error("Person must be a student in this class");
  }
}

async function ensureSession(
  ctx: MutationCtx & { userId: Id<"users"> },
  classId: Id<"classes">,
  dateKey: string,
  now: number,
): Promise<Id<"attendanceSessions">> {
  const existing = await ctx.db
    .query("attendanceSessions")
    .withIndex("by_classId_dateKey", (q) => q.eq("classId", classId).eq("dateKey", dateKey))
    .unique();
  if (existing) {
    await ctx.db.patch("attendanceSessions", existing._id, {
      takenBy: ctx.userId,
      updatedAt: now,
    });
    return existing._id;
  }
  return await ctx.db.insert("attendanceSessions", {
    classId,
    dateKey,
    takenBy: ctx.userId,
    createdAt: now,
    updatedAt: now,
  });
}

async function upsertRecord(
  ctx: MutationCtx & { userId: Id<"users"> },
  args: {
    classId: Id<"classes">;
    sessionId: Id<"attendanceSessions">;
    dateKey: string;
    studentUserId: Id<"users">;
    status: "present" | "absent" | "late";
    now: number;
  },
): Promise<void> {
  const existing = await ctx.db
    .query("attendanceRecords")
    .withIndex("by_session_student", (q) =>
      q.eq("sessionId", args.sessionId).eq("studentUserId", args.studentUserId),
    )
    .unique();
  if (existing) {
    await ctx.db.patch("attendanceRecords", existing._id, {
      status: args.status,
      updatedAt: args.now,
      updatedBy: ctx.userId,
    });
    return;
  }
  await ctx.db.insert("attendanceRecords", {
    classId: args.classId,
    sessionId: args.sessionId,
    dateKey: args.dateKey,
    studentUserId: args.studentUserId,
    status: args.status,
    updatedAt: args.now,
    updatedBy: ctx.userId,
  });
}

export const forDate = classQuery({
  args: {
    dateKey: v.string(),
  },
  returns: v.object({
    session: v.union(attendanceSessionValidator, v.null()),
    records: v.array(attendanceRecordValidator),
  }),
  handler: async (ctx, args) => {
    await ctx.require("attendance:manage");
    assertValidDateKey(args.dateKey);

    const classId = ctx.classDoc._id;
    const session = await ctx.db
      .query("attendanceSessions")
      .withIndex("by_classId_dateKey", (q) => q.eq("classId", classId).eq("dateKey", args.dateKey))
      .unique();

    if (!session) {
      return { session: null, records: [] };
    }

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded day roster
    const records = await ctx.db
      .query("attendanceRecords")
      .withIndex("by_classId_dateKey", (q) => q.eq("classId", classId).eq("dateKey", args.dateKey))
      .collect();

    return {
      session: {
        _id: session._id,
        _creationTime: session._creationTime,
        classId: session.classId,
        dateKey: session.dateKey,
        takenBy: session.takenBy,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      records: records.map((record) => ({
        _id: record._id,
        _creationTime: record._creationTime,
        classId: record.classId,
        sessionId: record.sessionId,
        dateKey: record.dateKey,
        studentUserId: record.studentUserId,
        status: record.status,
        updatedAt: record.updatedAt,
        updatedBy: record.updatedBy,
      })),
    };
  },
});

export const saveForDate = classMutation({
  args: {
    dateKey: v.string(),
    records: v.array(
      v.object({
        studentUserId: v.id("users"),
        status: attendanceStatusValidator,
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "attendanceSave", { key: ctx.userId, throws: true });
    await ctx.require("attendance:manage");
    assertValidDateKey(args.dateKey);

    const classId = ctx.classDoc._id;
    const now = Date.now();
    const seen = new Set<string>();
    for (const record of args.records) {
      if (seen.has(record.studentUserId)) {
        throw new Error("Duplicate student in attendance payload");
      }
      seen.add(record.studentUserId);
      await requireStudentInClass(ctx, classId, record.studentUserId);
    }

    const sessionId = await ensureSession(ctx, classId, args.dateKey, now);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded day roster
    const existingRecords = await ctx.db
      .query("attendanceRecords")
      .withIndex("by_classId_dateKey", (q) => q.eq("classId", classId).eq("dateKey", args.dateKey))
      .collect();

    const payloadByStudent = new Map(
      args.records.map((record) => [record.studentUserId as string, record.status]),
    );

    for (const existing of existingRecords) {
      if (!payloadByStudent.has(existing.studentUserId)) {
        await ctx.db.delete("attendanceRecords", existing._id);
      }
    }

    for (const record of args.records) {
      await upsertRecord(ctx, {
        classId,
        sessionId,
        dateKey: args.dateKey,
        studentUserId: record.studentUserId,
        status: record.status,
        now,
      });
    }

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "attendance",
      resourceId: sessionId,
      summary: `Saved attendance for ${args.dateKey}`,
      summaryKey: "activitySummary_savedAttendance",
      metadata: {
        dateKey: args.dateKey,
        count: String(args.records.length),
      },
    });

    return null;
  },
});

export const markStudentAbsent = classMutation({
  args: {
    studentUserId: v.id("users"),
    dateKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "attendanceMarkAbsent", { key: ctx.userId, throws: true });
    await ctx.require("attendance:manage");
    assertValidDateKey(args.dateKey);
    const classId = ctx.classDoc._id;
    await requireStudentInClass(ctx, classId, args.studentUserId);

    const now = Date.now();
    const sessionId = await ensureSession(ctx, classId, args.dateKey, now);
    await upsertRecord(ctx, {
      classId,
      sessionId,
      dateKey: args.dateKey,
      studentUserId: args.studentUserId,
      status: "absent",
      now,
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "attendance",
      resourceId: args.studentUserId,
      summary: `Marked student absent for ${args.dateKey}`,
      summaryKey: "activitySummary_markedStudentAbsent",
      metadata: {
        dateKey: args.dateKey,
        studentUserId: args.studentUserId,
      },
    });

    return null;
  },
});

export const markStudentPresent = classMutation({
  args: {
    studentUserId: v.id("users"),
    dateKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "attendanceMarkPresent", { key: ctx.userId, throws: true });
    await ctx.require("attendance:manage");
    assertValidDateKey(args.dateKey);
    const classId = ctx.classDoc._id;
    await requireStudentInClass(ctx, classId, args.studentUserId);

    const now = Date.now();
    const sessionId = await ensureSession(ctx, classId, args.dateKey, now);
    await upsertRecord(ctx, {
      classId,
      sessionId,
      dateKey: args.dateKey,
      studentUserId: args.studentUserId,
      status: "present",
      now,
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "attendance",
      resourceId: args.studentUserId,
      summary: `Marked student present for ${args.dateKey}`,
      summaryKey: "activitySummary_markedStudentPresent",
      metadata: {
        dateKey: args.dateKey,
        studentUserId: args.studentUserId,
      },
    });

    return null;
  },
});
