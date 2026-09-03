import { ConvexError, v } from "convex/values";

import { APP_CONFIG } from "./appConfig.js";
import { components, internal } from "./_generated/api.js";
import type { Doc, Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { internalMutation } from "./_generated/server.js";
import { classScope, type ClassPermission } from "./lib/authzModel.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import { getClassRoleForUser, listLinkedStudentsForGuardian } from "./lib/guardianLinks.js";
import { normalizeOptionalDueDateKey } from "./lib/dueDateKey.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import {
  applyReleaseSchedule,
  isHiddenFromStudents,
  publicReleaseFields,
} from "./lib/release/scheduledRelease.js";
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

const MAX_LINK_URL_LENGTH = 2000;
const MAX_LINK_LABEL_LENGTH = 100;

const taskProcedureStepValidator = v.object({
  key: v.string(),
  body: v.string(),
});

const taskResourceValidator = v.object({
  key: v.string(),
  url: v.string(),
  label: v.optional(v.string()),
});

const taskStudentLinkValidator = v.object({
  _id: v.id("taskStudentLinks"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  taskId: v.id("tasks"),
  studentUserId: v.id("users"),
  url: v.string(),
  label: v.optional(v.string()),
  handedIn: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

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
  procedureSteps: v.array(taskProcedureStepValidator),
  resources: v.array(taskResourceValidator),
  acceptLinkSubmissions: v.boolean(),
  hiddenFromStudents: v.boolean(),
  scheduledReleaseAt: v.optional(v.number()),
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
  links: v.array(taskStudentLinkValidator),
});

const taskDetailPersonalValidator = v.object({
  ...taskBaseFields,
  scope: v.literal("personal"),
  students: v.array(
    v.object({
      userId: v.id("users"),
      name: v.optional(v.string()),
      completed: v.boolean(),
      links: v.array(taskStudentLinkValidator),
      canEditLinks: v.boolean(),
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

function taskAcceptsLinkSubmissions(task: Doc<"tasks">): boolean {
  return task.acceptLinkSubmissions === true;
}

function assertTaskAcceptsLinkSubmissions(task: Doc<"tasks">): void {
  if (!taskAcceptsLinkSubmissions(task)) {
    throw new Error("This task does not accept submission links");
  }
}

function normalizeOptionalLabel(
  value: string | undefined,
  field: string,
  maxLength: number,
): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) {
    throw new Error(`${field} must be at most ${maxLength} characters`);
  }
  return trimmed;
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error("URL is required");
  }
  if (trimmed.length > MAX_LINK_URL_LENGTH) {
    throw new Error(`URL must be at most ${MAX_LINK_URL_LENGTH} characters`);
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL must start with http:// or https://");
  }
  return trimmed;
}

function toPublicLink(link: Doc<"taskStudentLinks">) {
  return {
    _id: link._id,
    _creationTime: link._creationTime,
    classId: link.classId,
    taskId: link.taskId,
    studentUserId: link.studentUserId,
    url: link.url,
    label: link.label,
    handedIn: link.handedIn,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
  };
}

function taskContentFields(task: Doc<"tasks">) {
  return {
    procedureSteps: task.procedureSteps ?? [],
    resources: task.resources ?? [],
    acceptLinkSubmissions: taskAcceptsLinkSubmissions(task),
    ...publicReleaseFields(task),
  };
}

async function applyTaskRelease(
  ctx: MutationCtx,
  taskId: Id<"tasks">,
  input: { hiddenFromStudents?: boolean; scheduledReleaseAt?: number },
  existingJobId?: Id<"_scheduled_functions">,
) {
  return await applyReleaseSchedule(ctx, {
    existingJobId,
    hiddenFromStudents: input.hiddenFromStudents,
    scheduledReleaseAt: input.scheduledReleaseAt,
    schedule: internal.tasks.applyScheduledRelease,
    scheduleArgs: { taskId },
  });
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
  procedureSteps: Array<{ key: string; body: string }>;
  resources: Array<{ key: string; url: string; label?: string }>;
  acceptLinkSubmissions: boolean;
  hiddenFromStudents: boolean;
  scheduledReleaseAt?: number;
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
    ...taskContentFields(task),
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
      if (audience.scope === "personal") {
        if (doc.archivedAt !== undefined || isHiddenFromStudents(doc)) {
          continue;
        }
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
    if (
      audience.scope === "personal" &&
      (task.archivedAt !== undefined || isHiddenFromStudents(task))
    ) {
      return null;
    }

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
      ...taskContentFields(task),
      attachmentFileIds,
      attachments,
    };

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- task-scoped student links
    const links = await ctx.db
      .query("taskStudentLinks")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();

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
        links: links.filter((link) => studentSet.has(link.studentUserId)).map(toPublicLink),
      };
    }

    const audienceIds = new Set(audience.students.map((student) => student.userId));
    const completedSet = new Set(
      completions.map((row) => row.studentUserId).filter((userId) => audienceIds.has(userId)),
    );
    const role = await getClassRoleForUser(ctx, ctx.userId, classScope(classId));

    return {
      ...base,
      scope: "personal" as const,
      students: audience.students.map((student) => ({
        userId: student.userId,
        ...(student.name ? { name: student.name } : {}),
        completed: completedSet.has(student.userId),
        links: links.filter((link) => link.studentUserId === student.userId).map(toPublicLink),
        canEditLinks: role === "student" && student.userId === ctx.userId,
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
    procedureSteps: v.optional(v.array(taskProcedureStepValidator)),
    resources: v.optional(v.array(taskResourceValidator)),
    acceptLinkSubmissions: v.optional(v.boolean()),
    hiddenFromStudents: v.optional(v.boolean()),
    scheduledReleaseAt: v.optional(v.number()),
  },
  returns: v.id("tasks"),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "taskCreate", { key: ctx.userId, throws: true });
    await ctx.require("tasks:manage");

    const classId = ctx.classDoc._id;
    const {
      hiddenFromStudents: _hiddenFromStudents,
      scheduledReleaseAt: _scheduledReleaseAt,
      ...formArgs
    } = args;
    const parsed = parseTaskInput(formArgs);
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
      procedureSteps: parsed.procedureSteps,
      resources: parsed.resources,
      acceptLinkSubmissions: args.acceptLinkSubmissions === true,
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });

    const release = await applyTaskRelease(ctx, taskId, {
      hiddenFromStudents: args.hiddenFromStudents,
      scheduledReleaseAt: args.scheduledReleaseAt,
    });
    await ctx.db.patch("tasks", taskId, release);

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
    procedureSteps: v.optional(v.array(taskProcedureStepValidator)),
    resources: v.optional(v.array(taskResourceValidator)),
    acceptLinkSubmissions: v.optional(v.boolean()),
    hiddenFromStudents: v.optional(v.boolean()),
    scheduledReleaseAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "taskUpdate", { key: ctx.userId, throws: true });
    await ctx.require("tasks:manage");

    const classId = ctx.classDoc._id;
    const existing = await requireTaskInClass(ctx, classId, args.taskId);
    const {
      hiddenFromStudents: _hiddenFromStudents,
      scheduledReleaseAt: _scheduledReleaseAt,
      ...formArgs
    } = args;
    const parsed = parseTaskInput(formArgs);
    const name = parsed.name;
    const description = normalizeOptionalDescription(parsed.description);
    const dueDateKey = normalizeOptionalDueDateKey(args.dueDateKey);
    const attachmentFileIds = normalizeAttachmentFileIds(
      args.attachmentFileIds ?? [],
      MAX_TASK_ATTACHMENTS,
    );
    await requireClassAttachmentFiles(ctx, classId, attachmentFileIds);
    const release = await applyTaskRelease(
      ctx,
      args.taskId,
      {
        hiddenFromStudents: args.hiddenFromStudents,
        scheduledReleaseAt: args.scheduledReleaseAt,
      },
      existing.scheduledReleaseJobId,
    );

    await ctx.db.patch("tasks", args.taskId, {
      name,
      description,
      dueDateKey,
      attachmentFileIds,
      worksheetImageFileId: undefined,
      procedureSteps: parsed.procedureSteps,
      resources: parsed.resources,
      acceptLinkSubmissions: args.acceptLinkSubmissions === true,
      ...release,
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

export const applyScheduledRelease = internalMutation({
  args: {
    taskId: v.id("tasks"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get("tasks", args.taskId);
    if (!task) return null;
    await ctx.db.patch("tasks", args.taskId, {
      hiddenFromStudents: undefined,
      scheduledReleaseAt: undefined,
      scheduledReleaseJobId: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const setReleased = classMutation({
  args: {
    taskId: v.id("tasks"),
    released: v.boolean(),
    scheduledReleaseAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "taskSetReleased", { key: ctx.userId, throws: true });
    await ctx.require("tasks:manage");

    const classId = ctx.classDoc._id;
    const existing = await requireTaskInClass(ctx, classId, args.taskId);
    const release = await applyTaskRelease(
      ctx,
      args.taskId,
      {
        hiddenFromStudents: !args.released,
        scheduledReleaseAt: args.released ? undefined : args.scheduledReleaseAt,
      },
      existing.scheduledReleaseJobId,
    );
    await ctx.db.patch("tasks", args.taskId, {
      ...release,
      updatedAt: Date.now(),
    });

    const scheduled = release.scheduledReleaseAt !== undefined;
    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "task",
      resourceId: args.taskId,
      summary: scheduled
        ? `Scheduled release for task "${existing.name}"`
        : args.released
          ? `Released task "${existing.name}"`
          : `Hid task "${existing.name}"`,
      summaryKey: scheduled
        ? "activitySummary_scheduledTaskRelease"
        : args.released
          ? "activitySummary_releasedTask"
          : "activitySummary_hidTask",
      metadata: { name: existing.name },
    });

    return null;
  },
});

export const addLink = classMutation({
  args: {
    taskId: v.id("tasks"),
    url: v.string(),
    label: v.optional(v.string()),
  },
  returns: v.id("taskStudentLinks"),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "taskLinkAdd", { key: ctx.userId, throws: true });

    const classId = ctx.classDoc._id;
    const task = await requireTaskInClass(ctx, classId, args.taskId);
    assertTaskAcceptsLinkSubmissions(task);
    await requireStudentInClass(ctx, classId, ctx.userId);

    const url = normalizeUrl(args.url);
    const label = normalizeOptionalLabel(args.label, "Label", MAX_LINK_LABEL_LENGTH);
    const now = Date.now();

    const linkId = await ctx.db.insert("taskStudentLinks", {
      classId,
      taskId: args.taskId,
      studentUserId: ctx.userId,
      url,
      ...(label !== undefined ? { label } : {}),
      handedIn: false,
      createdAt: now,
      updatedAt: now,
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "taskLink",
      resourceId: linkId,
      summary: `Added submission link for "${task.name}"`,
      summaryKey: "activitySummary_addedTaskLink",
      metadata: { name: task.name, taskId: args.taskId },
    });

    return linkId;
  },
});

export const updateLink = classMutation({
  args: {
    linkId: v.id("taskStudentLinks"),
    url: v.string(),
    label: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "taskLinkUpdate", { key: ctx.userId, throws: true });

    const classId = ctx.classDoc._id;
    const link = await ctx.db.get("taskStudentLinks", args.linkId);
    if (!link || link.classId !== classId) {
      throw new ConvexError({
        code: "TASK_UNAVAILABLE",
        message: "Link not found or access denied",
      });
    }
    if (link.studentUserId !== ctx.userId) {
      throw new Error("You can only edit your own links");
    }
    const task = await requireTaskInClass(ctx, classId, link.taskId);
    assertTaskAcceptsLinkSubmissions(task);

    const url = normalizeUrl(args.url);
    const label = normalizeOptionalLabel(args.label, "Label", MAX_LINK_LABEL_LENGTH);

    await ctx.db.patch("taskStudentLinks", args.linkId, {
      url,
      label,
      updatedAt: Date.now(),
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "taskLink",
      resourceId: args.linkId,
      summary: `Updated submission link for "${task.name}"`,
      summaryKey: "activitySummary_updatedTaskLink",
      metadata: { name: task.name, taskId: link.taskId },
    });

    return null;
  },
});

export const removeLink = classMutation({
  args: {
    linkId: v.id("taskStudentLinks"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "taskLinkRemove", { key: ctx.userId, throws: true });

    const classId = ctx.classDoc._id;
    const link = await ctx.db.get("taskStudentLinks", args.linkId);
    if (!link || link.classId !== classId) {
      throw new ConvexError({
        code: "TASK_UNAVAILABLE",
        message: "Link not found or access denied",
      });
    }
    if (link.studentUserId !== ctx.userId) {
      throw new Error("You can only remove your own links");
    }

    const task = await ctx.db.get("tasks", link.taskId);
    const taskName = task?.name ?? "task";
    await ctx.db.delete("taskStudentLinks", args.linkId);

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "taskLink",
      resourceId: args.linkId,
      summary: `Removed submission link for "${taskName}"`,
      summaryKey: "activitySummary_removedTaskLink",
      metadata: { name: taskName, taskId: link.taskId },
    });

    return null;
  },
});

export const setLinkHandedIn = classMutation({
  args: {
    linkId: v.id("taskStudentLinks"),
    handedIn: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "taskLinkSetHandedIn", { key: ctx.userId, throws: true });

    const classId = ctx.classDoc._id;
    const link = await ctx.db.get("taskStudentLinks", args.linkId);
    if (!link || link.classId !== classId) {
      throw new ConvexError({
        code: "TASK_UNAVAILABLE",
        message: "Link not found or access denied",
      });
    }
    if (link.studentUserId !== ctx.userId) {
      throw new Error("You can only update your own links");
    }
    const task = await requireTaskInClass(ctx, classId, link.taskId);
    assertTaskAcceptsLinkSubmissions(task);

    await ctx.db.patch("taskStudentLinks", args.linkId, {
      handedIn: args.handedIn,
      updatedAt: Date.now(),
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "taskLink",
      resourceId: args.linkId,
      summary: args.handedIn
        ? `Marked submission handed in for "${task.name}"`
        : `Unmarked submission handed in for "${task.name}"`,
      summaryKey: args.handedIn
        ? "activitySummary_markedTaskLinkHandedIn"
        : "activitySummary_unmarkedTaskLinkHandedIn",
      metadata: {
        name: task.name,
        taskId: link.taskId,
        handedIn: String(args.handedIn),
      },
    });

    return null;
  },
});
