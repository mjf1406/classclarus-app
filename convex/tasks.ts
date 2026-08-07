import { ConvexError, v } from "convex/values";

import { APP_CONFIG } from "./appConfig.js";
import { components } from "./_generated/api.js";
import type { Doc, Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { classScope, type ClassPermission } from "./lib/authzModel.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import { getClassRoleForUser, listLinkedStudentsForGuardian } from "./lib/guardianLinks.js";
import { rateLimiter } from "./lib/rateLimiter.js";

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const taskBaseFields = {
  _id: v.id("tasks"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  name: v.string(),
  description: v.optional(v.string()),
  dueDateKey: v.optional(v.string()),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
};

const taskValidator = v.object({
  ...taskBaseFields,
  completedCount: v.number(),
  studentCount: v.number(),
});

const taskDetailClassValidator = v.object({
  ...taskBaseFields,
  scope: v.literal("class"),
  completedStudentIds: v.array(v.id("users")),
  studentCount: v.number(),
});

const taskDetailPersonalValidator = v.object({
  ...taskBaseFields,
  scope: v.literal("personal"),
  students: v.array(
    v.object({
      userId: v.id("users"),
      name: v.optional(v.string()),
      completed: v.boolean(),
    }),
  ),
});

const taskDetailValidator = v.union(taskDetailClassValidator, taskDetailPersonalValidator);

type TaskAudience =
  | { scope: "class"; studentIds: Array<Id<"users">> }
  | {
      scope: "personal";
      students: Array<{ userId: Id<"users">; name?: string }>;
    };

type ClassAuthCtx = (QueryCtx | MutationCtx) & {
  userId: Id<"users">;
  can: (permission: ClassPermission) => Promise<boolean>;
};

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Name is required");
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new Error(`Name must be at most ${MAX_NAME_LENGTH} characters`);
  }
  return trimmed;
}

function normalizeOptionalDescription(description: string | undefined): string | undefined {
  if (description === undefined) return undefined;
  const trimmed = description.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
  }
  return trimmed;
}

function normalizeOptionalDueDateKey(dueDateKey: string | undefined): string | undefined {
  if (dueDateKey === undefined) return undefined;
  const trimmed = dueDateKey.trim();
  if (!trimmed) return undefined;
  if (!DATE_KEY_RE.test(trimmed)) {
    throw new Error("Invalid due date");
  }
  return trimmed;
}

async function listStudentUserIds(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
): Promise<Array<Id<"users">>> {
  const users = await ctx.runQuery(components.authz.queries.getUsersWithRole, {
    tenantId: APP_CONFIG.authzTenantId,
    role: "student",
    scope: classScope(classId),
  });
  return users.map((entry: { userId: string }) => entry.userId as Id<"users">);
}

async function resolveTaskAudience(
  ctx: ClassAuthCtx,
  classId: Id<"classes">,
): Promise<TaskAudience> {
  if (await ctx.can("tasks:complete")) {
    return { scope: "class", studentIds: await listStudentUserIds(ctx, classId) };
  }

  const role = await getClassRoleForUser(ctx, ctx.userId, classScope(classId));
  if (role === "student") {
    const user = await ctx.db.get("users", ctx.userId);
    return {
      scope: "personal",
      students: [{ userId: ctx.userId, ...(user?.name ? { name: user.name } : {}) }],
    };
  }
  if (role === "guardian") {
    const linked = await listLinkedStudentsForGuardian(ctx, classId, ctx.userId);
    return {
      scope: "personal",
      students: linked.map((student) => ({
        userId: student.userId,
        ...(student.name ? { name: student.name } : {}),
      })),
    };
  }
  return { scope: "personal", students: [] };
}

async function requireTaskInClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  taskId: Id<"tasks">,
): Promise<Doc<"tasks">> {
  const task = await ctx.db.get("tasks", taskId);
  if (!task || task.classId !== classId) {
    throw new ConvexError({
      code: "TASK_UNAVAILABLE",
      message: "Task not found or access denied",
    });
  }
  return task;
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

async function deleteCompletionsForTask(ctx: MutationCtx, taskId: Id<"tasks">): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- task-scoped cleanup
  const completions = await ctx.db
    .query("taskCompletions")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .collect();
  for (const completion of completions) {
    await ctx.db.delete("taskCompletions", completion._id);
  }
}

function toPublicTask(
  task: Doc<"tasks">,
  completedCount: number,
  studentCount: number,
): {
  _id: Id<"tasks">;
  _creationTime: number;
  classId: Id<"classes">;
  name: string;
  description?: string;
  dueDateKey?: string;
  createdBy: Id<"users">;
  createdAt: number;
  updatedAt: number;
  completedCount: number;
  studentCount: number;
} {
  return {
    _id: task._id,
    _creationTime: task._creationTime,
    classId: task.classId,
    name: task.name,
    description: task.description,
    dueDateKey: task.dueDateKey,
    createdBy: task.createdBy,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedCount,
    studentCount,
  };
}

/**
 * List tasks for a class with completion stats scoped to the viewer's audience.
 */
export const list = classQuery({
  args: {},
  returns: v.array(taskValidator),
  handler: async (ctx) => {
    const classId = ctx.classDoc._id;
    const audience = await resolveTaskAudience(ctx, classId);
    const studentIds =
      audience.scope === "class"
        ? audience.studentIds
        : audience.students.map((student) => student.userId);
    const studentSet = new Set(studentIds);
    const studentCount = studentIds.length;

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const docs = await ctx.db
      .query("tasks")
      .withIndex("by_classId_updatedAt", (q) => q.eq("classId", classId))
      .order("desc")
      .collect();

    const result = [];
    for (const doc of docs) {
      // eslint-disable-next-line @convex-dev/no-collect-in-query -- task-scoped completions
      const completions = await ctx.db
        .query("taskCompletions")
        .withIndex("by_task", (q) => q.eq("taskId", doc._id))
        .collect();
      const completedCount = completions.filter((row) => studentSet.has(row.studentUserId)).length;
      result.push(toPublicTask(doc, completedCount, studentCount));
    }
    return result;
  },
});

/**
 * Get a single task. Staff see class-wide completion ids; students/guardians
 * receive only their pertinent students (self or linked).
 */
export const get = classQuery({
  args: {
    taskId: v.id("tasks"),
  },
  returns: v.union(taskDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const classId = ctx.classDoc._id;
    const task = await ctx.db.get("tasks", args.taskId);
    if (!task || task.classId !== classId) {
      return null;
    }

    const audience = await resolveTaskAudience(ctx, classId);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- task-scoped completions
    const completions = await ctx.db
      .query("taskCompletions")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

    const base = {
      _id: task._id,
      _creationTime: task._creationTime,
      classId: task.classId,
      name: task.name,
      description: task.description,
      dueDateKey: task.dueDateKey,
      createdBy: task.createdBy,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };

    if (audience.scope === "class") {
      const studentSet = new Set(audience.studentIds);
      const completedStudentIds = completions
        .map((row) => row.studentUserId)
        .filter((userId) => studentSet.has(userId));
      return {
        ...base,
        scope: "class" as const,
        completedStudentIds,
        studentCount: audience.studentIds.length,
      };
    }

    const audienceIds = new Set(audience.students.map((student) => student.userId));
    const completedSet = new Set(
      completions.map((row) => row.studentUserId).filter((userId) => audienceIds.has(userId)),
    );

    return {
      ...base,
      scope: "personal" as const,
      students: audience.students.map((student) => ({
        userId: student.userId,
        ...(student.name ? { name: student.name } : {}),
        completed: completedSet.has(student.userId),
      })),
    };
  },
});

export const create = classMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    dueDateKey: v.optional(v.string()),
  },
  returns: v.id("tasks"),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "taskCreate", { key: ctx.userId, throws: true });
    await ctx.require("tasks:manage");

    const classId = ctx.classDoc._id;
    const name = normalizeName(args.name);
    const description = normalizeOptionalDescription(args.description);
    const dueDateKey = normalizeOptionalDueDateKey(args.dueDateKey);
    const now = Date.now();

    const taskId = await ctx.db.insert("tasks", {
      classId,
      name,
      ...(description !== undefined ? { description } : {}),
      ...(dueDateKey !== undefined ? { dueDateKey } : {}),
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "task",
      resourceId: taskId,
      summary: `Created task "${name}"`,
      summaryKey: "activitySummary_createdTask",
      metadata: { name },
    });

    return taskId;
  },
});

export const update = classMutation({
  args: {
    taskId: v.id("tasks"),
    name: v.string(),
    description: v.optional(v.string()),
    dueDateKey: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "taskUpdate", { key: ctx.userId, throws: true });
    await ctx.require("tasks:manage");

    const classId = ctx.classDoc._id;
    await requireTaskInClass(ctx, classId, args.taskId);
    const name = normalizeName(args.name);
    const description = normalizeOptionalDescription(args.description);
    const dueDateKey = normalizeOptionalDueDateKey(args.dueDateKey);

    await ctx.db.patch("tasks", args.taskId, {
      name,
      description,
      dueDateKey,
      updatedAt: Date.now(),
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "task",
      resourceId: args.taskId,
      summary: `Updated task "${name}"`,
      summaryKey: "activitySummary_updatedTask",
      metadata: { name },
    });

    return null;
  },
});

export const remove = classMutation({
  args: {
    taskId: v.id("tasks"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "taskRemove", { key: ctx.userId, throws: true });
    await ctx.require("tasks:manage");

    const classId = ctx.classDoc._id;
    const existing = await requireTaskInClass(ctx, classId, args.taskId);
    await deleteCompletionsForTask(ctx, args.taskId);
    await ctx.db.delete("tasks", args.taskId);

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "task",
      resourceId: args.taskId,
      summary: `Deleted task "${existing.name}"`,
      summaryKey: "activitySummary_deletedTask",
      metadata: { name: existing.name },
    });

    return null;
  },
});

export const setCompletion = classMutation({
  args: {
    taskId: v.id("tasks"),
    studentUserId: v.id("users"),
    completed: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "taskSetCompletion", { key: ctx.userId, throws: true });
    await ctx.require("tasks:complete");

    const classId = ctx.classDoc._id;
    await requireTaskInClass(ctx, classId, args.taskId);
    await requireStudentInClass(ctx, classId, args.studentUserId);

    const existing = await ctx.db
      .query("taskCompletions")
      .withIndex("by_task_student", (q) =>
        q.eq("taskId", args.taskId).eq("studentUserId", args.studentUserId),
      )
      .unique();

    if (args.completed) {
      if (!existing) {
        await ctx.db.insert("taskCompletions", {
          classId,
          taskId: args.taskId,
          studentUserId: args.studentUserId,
          completedAt: Date.now(),
          completedBy: ctx.userId,
        });
      }
    } else if (existing) {
      await ctx.db.delete("taskCompletions", existing._id);
    }

    return null;
  },
});
