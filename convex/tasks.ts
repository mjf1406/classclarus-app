import { ConvexError, v } from "convex/values";

import { APP_CONFIG } from "./appConfig.js";
import { components } from "./_generated/api.js";
import type { Doc, Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { classScope, type ClassPermission } from "./lib/authzModel.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import { getClassRoleForUser, listLinkedStudentsForGuardian } from "./lib/guardianLinks.js";
import { normalizeOptionalDueDateKey } from "./lib/dueDateKey.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import { stripAgendaTaskReferences } from "./lib/cleanup/timetableCleanup.js";
import {
  loadAttachmentMeta,
  normalizeAttachmentFileIds,
  requireClassAttachmentFiles,
  resolveTaskAttachmentFileIds,
  taskAttachmentPublicFields,
} from "./lib/files/classFileRefs.js";
import { MAX_TASK_ATTACHMENTS, parseTaskInput } from "./lib/tasks/taskSchema.js";
import { deleteTaskWithCompletions } from "./lib/tasksCleanup.js";

const taskBaseFields = {
  _id: v.id("tasks"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  name: v.string(),
  description: v.optional(v.string()),
  dueDateKey: v.optional(v.string()),
  assignmentId: v.optional(v.id("assignments")),
  assignmentName: v.optional(v.string()),
  assignmentSubject: v.optional(v.string()),
  assignmentUnit: v.optional(v.string()),
  /** 1-based procedure step index when linked from an assignment. */
  procedureStepNumber: v.optional(v.number()),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
  archivedAt: v.optional(v.number()),
  ...taskAttachmentPublicFields,
};

const taskValidator = v.object({
  ...taskBaseFields,
  completedCount: v.number(),
  studentCount: v.number(),
  completedStudentIds: v.array(v.id("users")),
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

function normalizeOptionalDescription(description: string): string | undefined {
  const trimmed = description.trim();
  return trimmed ? trimmed : undefined;
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

type TaskAssignmentMeta = {
  assignmentId: Id<"assignments">;
  assignmentName: string;
  assignmentSubject?: string;
  assignmentUnit?: string;
  procedureStepNumber?: number;
};

function toAssignmentMeta(assignment: Doc<"assignments">): TaskAssignmentMeta {
  return {
    assignmentId: assignment._id,
    assignmentName: assignment.name,
    ...(assignment.subject ? { assignmentSubject: assignment.subject } : {}),
    ...(assignment.unit ? { assignmentUnit: assignment.unit } : {}),
  };
}

/** Resolve assignment linkage from task.assignmentId and/or procedure step taskIds. */
async function buildTaskAssignmentIndex(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
): Promise<{
  byAssignmentId: Map<Id<"assignments">, TaskAssignmentMeta>;
  byTaskId: Map<Id<"tasks">, TaskAssignmentMeta>;
}> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded assignments
  const assignments = await ctx.db
    .query("assignments")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();

  const byAssignmentId = new Map<Id<"assignments">, TaskAssignmentMeta>();
  const byTaskId = new Map<Id<"tasks">, TaskAssignmentMeta>();

  for (const assignment of assignments) {
    const meta = toAssignmentMeta(assignment);
    byAssignmentId.set(assignment._id, meta);
    assignment.procedureSteps.forEach((step, index) => {
      if (step.taskId) {
        byTaskId.set(step.taskId, {
          ...meta,
          procedureStepNumber: index + 1,
        });
      }
    });
  }

  return { byAssignmentId, byTaskId };
}

function resolveTaskAssignment(
  task: Doc<"tasks">,
  index: {
    byAssignmentId: Map<Id<"assignments">, TaskAssignmentMeta>;
    byTaskId: Map<Id<"tasks">, TaskAssignmentMeta>;
  },
): TaskAssignmentMeta | undefined {
  const fromStep = index.byTaskId.get(task._id);
  if (fromStep) return fromStep;
  if (task.assignmentId) {
    return index.byAssignmentId.get(task.assignmentId);
  }
  return undefined;
}

function toPublicTask(
  task: Doc<"tasks">,
  completedStudentIds: Array<Id<"users">>,
  studentCount: number,
  assignment: TaskAssignmentMeta | undefined,
): {
  _id: Id<"tasks">;
  _creationTime: number;
  classId: Id<"classes">;
  name: string;
  description?: string;
  dueDateKey?: string;
  assignmentId?: Id<"assignments">;
  assignmentName?: string;
  assignmentSubject?: string;
  assignmentUnit?: string;
  procedureStepNumber?: number;
  createdBy: Id<"users">;
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
  attachmentFileIds: Array<Id<"files">>;
  completedCount: number;
  studentCount: number;
  completedStudentIds: Array<Id<"users">>;
} {
  return {
    _id: task._id,
    _creationTime: task._creationTime,
    classId: task.classId,
    name: task.name,
    description: task.description,
    dueDateKey: task.dueDateKey,
    attachmentFileIds: resolveTaskAttachmentFileIds(task),
    ...(assignment
      ? {
          assignmentId: assignment.assignmentId,
          assignmentName: assignment.assignmentName,
          ...(assignment.assignmentSubject
            ? { assignmentSubject: assignment.assignmentSubject }
            : {}),
          ...(assignment.assignmentUnit ? { assignmentUnit: assignment.assignmentUnit } : {}),
          ...(assignment.procedureStepNumber !== undefined
            ? { procedureStepNumber: assignment.procedureStepNumber }
            : {}),
        }
      : {}),
    createdBy: task.createdBy,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    ...(task.archivedAt !== undefined ? { archivedAt: task.archivedAt } : {}),
    completedCount: completedStudentIds.length,
    studentCount,
    completedStudentIds,
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

    const assignmentIndex = await buildTaskAssignmentIndex(ctx, classId);

    const result = [];
    for (const doc of docs) {
      if (doc.archivedAt !== undefined && audience.scope === "personal") {
        continue;
      }
      // eslint-disable-next-line @convex-dev/no-collect-in-query -- task-scoped completions
      const completions = await ctx.db
        .query("taskCompletions")
        .withIndex("by_task", (q) => q.eq("taskId", doc._id))
        .collect();
      const completedStudentIds = completions
        .map((row) => row.studentUserId)
        .filter((userId) => studentSet.has(userId));
      const publicTask = toPublicTask(
        doc,
        completedStudentIds,
        studentCount,
        resolveTaskAssignment(doc, assignmentIndex),
      );
      const attachments = await loadAttachmentMeta(ctx, publicTask.attachmentFileIds);
      result.push({ ...publicTask, attachments });
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

    const assignmentIndex = await buildTaskAssignmentIndex(ctx, classId);
    const assignment = resolveTaskAssignment(task, assignmentIndex);
    const attachmentFileIds = resolveTaskAttachmentFileIds(task);
    const attachments = await loadAttachmentMeta(ctx, attachmentFileIds);
    const base = {
      _id: task._id,
      _creationTime: task._creationTime,
      classId: task.classId,
      name: task.name,
      description: task.description,
      dueDateKey: task.dueDateKey,
      ...(assignment
        ? {
            assignmentId: assignment.assignmentId,
            assignmentName: assignment.assignmentName,
            ...(assignment.assignmentSubject
              ? { assignmentSubject: assignment.assignmentSubject }
              : {}),
            ...(assignment.assignmentUnit ? { assignmentUnit: assignment.assignmentUnit } : {}),
            ...(assignment.procedureStepNumber !== undefined
              ? { procedureStepNumber: assignment.procedureStepNumber }
              : {}),
          }
        : {}),
      createdBy: task.createdBy,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      ...(task.archivedAt !== undefined ? { archivedAt: task.archivedAt } : {}),
      attachmentFileIds,
      attachments,
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
    attachmentFileIds: v.optional(v.array(v.id("files"))),
  },
  returns: v.id("tasks"),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "taskCreate", { key: ctx.userId, throws: true });
    await ctx.require("tasks:manage");

    const classId = ctx.classDoc._id;
    const parsed = parseTaskInput(args);
    const name = parsed.name;
    const description = normalizeOptionalDescription(parsed.description);
    const dueDateKey = normalizeOptionalDueDateKey(args.dueDateKey);
    const attachmentFileIds = normalizeAttachmentFileIds(
      args.attachmentFileIds ?? [],
      MAX_TASK_ATTACHMENTS,
    );
    await requireClassAttachmentFiles(ctx, classId, attachmentFileIds);
    const now = Date.now();

    const taskId = await ctx.db.insert("tasks", {
      classId,
      name,
      ...(description !== undefined ? { description } : {}),
      ...(dueDateKey !== undefined ? { dueDateKey } : {}),
      attachmentFileIds,
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
    attachmentFileIds: v.optional(v.array(v.id("files"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "taskUpdate", { key: ctx.userId, throws: true });
    await ctx.require("tasks:manage");

    const classId = ctx.classDoc._id;
    await requireTaskInClass(ctx, classId, args.taskId);
    const parsed = parseTaskInput(args);
    const name = parsed.name;
    const description = normalizeOptionalDescription(parsed.description);
    const dueDateKey = normalizeOptionalDueDateKey(args.dueDateKey);
    const attachmentFileIds = normalizeAttachmentFileIds(
      args.attachmentFileIds ?? [],
      MAX_TASK_ATTACHMENTS,
    );
    await requireClassAttachmentFiles(ctx, classId, attachmentFileIds);

    await ctx.db.patch("tasks", args.taskId, {
      name,
      description,
      dueDateKey,
      attachmentFileIds,
      worksheetImageFileId: undefined,
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

export const setArchived = classMutation({
  args: {
    taskId: v.id("tasks"),
    archived: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "taskSetArchived", { key: ctx.userId, throws: true });
    await ctx.require("tasks:manage");

    const classId = ctx.classDoc._id;
    const existing = await requireTaskInClass(ctx, classId, args.taskId);
    const now = Date.now();
    await ctx.db.patch("tasks", args.taskId, {
      archivedAt: args.archived ? now : undefined,
      updatedAt: now,
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "task",
      resourceId: args.taskId,
      summary: args.archived
        ? `Archived task "${existing.name}"`
        : `Unarchived task "${existing.name}"`,
      summaryKey: args.archived ? "activitySummary_archivedTask" : "activitySummary_unarchivedTask",
      metadata: { name: existing.name, archived: String(args.archived) },
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
    await stripAgendaTaskReferences(ctx, classId, args.taskId);
    await deleteTaskWithCompletions(ctx, args.taskId);

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
    const task = await requireTaskInClass(ctx, classId, args.taskId);
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
        await recordClassActivity(ctx, {
          classId,
          actorUserId: ctx.userId,
          action: "write",
          resourceType: "taskCompletion",
          resourceId: args.taskId,
          summary: `Marked task "${task.name}" complete`,
          summaryKey: "activitySummary_markedTaskComplete",
          metadata: {
            name: task.name,
            studentUserId: args.studentUserId,
          },
        });
      }
    } else if (existing) {
      await ctx.db.delete("taskCompletions", existing._id);
      await recordClassActivity(ctx, {
        classId,
        actorUserId: ctx.userId,
        action: "delete",
        resourceType: "taskCompletion",
        resourceId: args.taskId,
        summary: `Cleared completion for task "${task.name}"`,
        summaryKey: "activitySummary_clearedTaskCompletion",
        metadata: {
          name: task.name,
          studentUserId: args.studentUserId,
        },
      });
    }

    return null;
  },
});
