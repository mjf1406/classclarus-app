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
import { deleteScoresForAssignment } from "./lib/assignmentScoresCleanup.js";
import { deleteTaskWithCompletions } from "./lib/tasksCleanup.js";

const MAX_NAME_LENGTH = 100;
const MAX_SUBJECT_LENGTH = 100;
const MAX_UNIT_LENGTH = 100;
const MAX_SECTION_NAME_LENGTH = 100;
const MAX_LEVEL_DESCRIPTION_LENGTH = 500;
const MAX_PROCEDURE_STEP_LENGTH = 500;
const MAX_LINK_URL_LENGTH = 2000;
const MAX_LINK_LABEL_LENGTH = 100;
const MAX_INSTRUCTIONS_JSON_LENGTH = 50_000;
const MAX_SECTIONS = 30;
const MAX_LEVELS_PER_SECTION = 20;
const MAX_ITEMS_PER_SECTION = 30;
const MAX_PROCEDURE_STEPS = 50;
const MAX_EXPECTATIONS = 20;
const EMPTY_INSTRUCTIONS_JSON = JSON.stringify({
  type: "doc",
  content: [{ type: "paragraph" }],
});

const rubricEntryValidator = v.object({
  key: v.string(),
  description: v.string(),
  points: v.number(),
});

const sectionValidator = v.object({
  key: v.string(),
  name: v.string(),
  type: v.union(v.literal("points"), v.literal("rubricLevels"), v.literal("rubricCheckboxes")),
  maxPoints: v.optional(v.number()),
  levels: v.optional(v.array(rubricEntryValidator)),
  items: v.optional(v.array(rubricEntryValidator)),
});

const procedureStepValidator = v.object({
  key: v.string(),
  body: v.string(),
  addAsTask: v.boolean(),
  taskId: v.optional(v.id("tasks")),
  taskCompletedCount: v.optional(v.number()),
  taskStudentCount: v.optional(v.number()),
});

const assignmentBaseFields = {
  _id: v.id("assignments"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  name: v.string(),
  subject: v.optional(v.string()),
  unit: v.optional(v.string()),
  dueDateKey: v.optional(v.string()),
  instructionsJson: v.optional(v.string()),
  scoringMode: v.union(v.literal("total"), v.literal("sections")),
  totalPoints: v.optional(v.number()),
  sections: v.optional(v.array(sectionValidator)),
  procedureSteps: v.array(procedureStepValidator),
  expectationIds: v.array(v.id("expectations")),
  acceptLinkSubmissions: v.boolean(),
  scoresReleased: v.boolean(),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
};

const viewerReleasedScoreValidator = v.object({
  studentUserId: v.id("users"),
  totalPointsEarned: v.optional(v.number()),
  sectionScores: v.optional(
    v.array(
      v.object({
        sectionKey: v.string(),
        pointsEarned: v.optional(v.number()),
        selectedLevelKey: v.optional(v.string()),
        checkedItemKeys: v.optional(v.array(v.string())),
      }),
    ),
  ),
  excused: v.boolean(),
});

const assignmentListItemValidator = v.object({
  ...assignmentBaseFields,
  handedInStudentCount: v.number(),
  studentCount: v.number(),
  linkCount: v.number(),
  hasInstructions: v.boolean(),
  hasProcedure: v.boolean(),
  /** Personal audience only, when scoresReleased — scores for the viewer's students. */
  viewerReleasedScores: v.optional(v.array(viewerReleasedScoreValidator)),
});

const studentLinkValidator = v.object({
  _id: v.id("assignmentStudentLinks"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  assignmentId: v.id("assignments"),
  studentUserId: v.id("users"),
  url: v.string(),
  label: v.optional(v.string()),
  handedIn: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const expectationSummaryValidator = v.object({
  _id: v.id("expectations"),
  name: v.string(),
  unit: v.string(),
  inputType: v.union(v.literal("number"), v.literal("numberRange")),
  numberValue: v.optional(v.number()),
  rangeMin: v.optional(v.number()),
  rangeMax: v.optional(v.number()),
});

const assignmentDetailClassValidator = v.object({
  ...assignmentBaseFields,
  scope: v.literal("class"),
  studentCount: v.number(),
  links: v.array(studentLinkValidator),
  expectations: v.array(
    v.object({
      _id: v.id("expectations"),
      name: v.string(),
      unit: v.string(),
      inputType: v.union(v.literal("number"), v.literal("numberRange")),
    }),
  ),
});

const assignmentDetailPersonalValidator = v.object({
  ...assignmentBaseFields,
  scope: v.literal("personal"),
  students: v.array(
    v.object({
      userId: v.id("users"),
      name: v.optional(v.string()),
      firstName: v.optional(v.string()),
      lastName: v.optional(v.string()),
      links: v.array(studentLinkValidator),
      expectations: v.array(expectationSummaryValidator),
      canEditLinks: v.boolean(),
    }),
  ),
});

const assignmentDetailValidator = v.union(
  assignmentDetailClassValidator,
  assignmentDetailPersonalValidator,
);

const sectionInputValidator = v.object({
  key: v.string(),
  name: v.string(),
  type: v.union(v.literal("points"), v.literal("rubricLevels"), v.literal("rubricCheckboxes")),
  maxPoints: v.optional(v.number()),
  levels: v.optional(v.array(rubricEntryValidator)),
  items: v.optional(v.array(rubricEntryValidator)),
});

const procedureStepInputValidator = v.object({
  key: v.string(),
  body: v.string(),
  addAsTask: v.boolean(),
  taskId: v.optional(v.id("tasks")),
});

type AssignmentAudience =
  | { scope: "class"; studentIds: Array<Id<"users">> }
  | {
      scope: "personal";
      students: Array<{ userId: Id<"users">; name?: string; canEditLinks: boolean }>;
    };

type ClassAuthCtx = (QueryCtx | MutationCtx) & {
  userId: Id<"users">;
  can: (permission: ClassPermission) => Promise<boolean>;
};

type RubricEntry = { key: string; description: string; points: number };
type AssignmentSection = {
  key: string;
  name: string;
  type: "points" | "rubricLevels" | "rubricCheckboxes";
  maxPoints?: number;
  levels?: Array<RubricEntry>;
  items?: Array<RubricEntry>;
};
type ProcedureStep = {
  key: string;
  body: string;
  addAsTask: boolean;
  taskId?: Id<"tasks">;
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

function normalizeOptionalLabel(
  value: string | undefined,
  field: string,
  maxLength: number,
): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) {
    throw new Error(`${field} must be at most ${maxLength} characters`);
  }
  return trimmed;
}

function tiptapTextContent(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const record = node as { text?: unknown; content?: unknown };
  const own = typeof record.text === "string" ? record.text : "";
  if (!Array.isArray(record.content)) return own;
  return own + record.content.map((child) => tiptapTextContent(child)).join("");
}

function normalizeOptionalInstructionsJson(
  instructionsJson: string | undefined,
): string | undefined {
  if (instructionsJson === undefined) return undefined;
  const trimmed = instructionsJson.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_INSTRUCTIONS_JSON_LENGTH) {
    throw new Error(`Instructions must be at most ${MAX_INSTRUCTIONS_JSON_LENGTH} characters`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("Invalid instructions");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid instructions");
  }
  const doc = parsed as { type?: unknown };
  if (doc.type !== "doc") {
    throw new Error("Invalid instructions");
  }
  if (tiptapTextContent(parsed).trim().length === 0) {
    return undefined;
  }
  return trimmed;
}

function normalizeRubricEntries(
  entries: Array<RubricEntry> | undefined,
  kind: string,
  max: number,
): Array<RubricEntry> {
  if (!entries || entries.length === 0) {
    throw new Error(`${kind} require at least one entry`);
  }
  if (entries.length > max) {
    throw new Error(`At most ${max} ${kind.toLowerCase()} allowed`);
  }
  return entries.map((entry, index) => {
    const key = entry.key.trim() || `entry-${index}`;
    const description = entry.description.trim();
    if (!description) {
      throw new Error(`${kind} description is required`);
    }
    if (description.length > MAX_LEVEL_DESCRIPTION_LENGTH) {
      throw new Error(
        `${kind} description must be at most ${MAX_LEVEL_DESCRIPTION_LENGTH} characters`,
      );
    }
    if (!Number.isFinite(entry.points) || entry.points < 0) {
      throw new Error(`${kind} points must be a non-negative number`);
    }
    return { key, description, points: entry.points };
  });
}

function normalizeSections(
  scoringMode: "total" | "sections",
  totalPoints: number | undefined,
  sections: Array<AssignmentSection> | undefined,
): {
  scoringMode: "total" | "sections";
  totalPoints?: number;
  sections?: Array<AssignmentSection>;
} {
  if (scoringMode === "total") {
    if (totalPoints === undefined || !Number.isFinite(totalPoints) || totalPoints < 0) {
      throw new Error("Total points must be a non-negative number");
    }
    return { scoringMode, totalPoints };
  }

  if (!sections || sections.length === 0) {
    throw new Error("Add at least one scoring section");
  }
  if (sections.length > MAX_SECTIONS) {
    throw new Error(`At most ${MAX_SECTIONS} sections allowed`);
  }

  const normalized = sections.map((section, index) => {
    const key = section.key.trim() || `section-${index}`;
    const name = section.name.trim();
    if (!name) {
      throw new Error("Section name is required");
    }
    if (name.length > MAX_SECTION_NAME_LENGTH) {
      throw new Error(`Section name must be at most ${MAX_SECTION_NAME_LENGTH} characters`);
    }

    if (section.type === "points") {
      if (
        section.maxPoints === undefined ||
        !Number.isFinite(section.maxPoints) ||
        section.maxPoints < 0
      ) {
        throw new Error("Section max points must be a non-negative number");
      }
      return {
        key,
        name,
        type: "points" as const,
        maxPoints: section.maxPoints,
      };
    }

    if (section.type === "rubricLevels") {
      return {
        key,
        name,
        type: "rubricLevels" as const,
        levels: normalizeRubricEntries(section.levels, "Rubric levels", MAX_LEVELS_PER_SECTION),
      };
    }

    return {
      key,
      name,
      type: "rubricCheckboxes" as const,
      items: normalizeRubricEntries(section.items, "Rubric checkboxes", MAX_ITEMS_PER_SECTION),
    };
  });

  return { scoringMode, sections: normalized };
}

function normalizeProcedureSteps(steps: Array<ProcedureStep> | undefined): Array<ProcedureStep> {
  if (!steps || steps.length === 0) return [];
  if (steps.length > MAX_PROCEDURE_STEPS) {
    throw new Error(`At most ${MAX_PROCEDURE_STEPS} procedure steps allowed`);
  }
  return steps.map((step, index) => {
    const key = step.key.trim() || `step-${index}`;
    const body = step.body.trim();
    if (!body) {
      throw new Error("Procedure step text is required");
    }
    if (body.length > MAX_PROCEDURE_STEP_LENGTH) {
      throw new Error(`Procedure step must be at most ${MAX_PROCEDURE_STEP_LENGTH} characters`);
    }
    return {
      key,
      body,
      addAsTask: step.addAsTask,
      ...(step.taskId ? { taskId: step.taskId } : {}),
    };
  });
}

async function normalizeExpectationIds(
  ctx: MutationCtx,
  classId: Id<"classes">,
  expectationIds: Array<Id<"expectations">>,
): Promise<Array<Id<"expectations">>> {
  const unique = [...new Set(expectationIds)];
  if (unique.length > MAX_EXPECTATIONS) {
    throw new Error(`At most ${MAX_EXPECTATIONS} expectations allowed`);
  }
  for (const expectationId of unique) {
    const expectation = await ctx.db.get("expectations", expectationId);
    if (!expectation || expectation.classId !== classId) {
      throw new Error("Expectation not found or access denied");
    }
  }
  return unique;
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

async function resolveAssignmentAudience(
  ctx: ClassAuthCtx,
  classId: Id<"classes">,
): Promise<AssignmentAudience> {
  if (await ctx.can("students:read")) {
    return { scope: "class", studentIds: await listStudentUserIds(ctx, classId) };
  }

  const role = await getClassRoleForUser(ctx, ctx.userId, classScope(classId));
  if (role === "student") {
    const user = await ctx.db.get("users", ctx.userId);
    return {
      scope: "personal",
      students: [
        {
          userId: ctx.userId,
          ...(user?.name ? { name: user.name } : {}),
          canEditLinks: true,
        },
      ],
    };
  }
  if (role === "guardian") {
    const linked = await listLinkedStudentsForGuardian(ctx, classId, ctx.userId);
    return {
      scope: "personal",
      students: linked.map((student) => ({
        userId: student.userId,
        ...(student.name ? { name: student.name } : {}),
        canEditLinks: false,
      })),
    };
  }
  return { scope: "personal", students: [] };
}

async function requireAssignmentInClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  assignmentId: Id<"assignments">,
): Promise<Doc<"assignments">> {
  const assignment = await ctx.db.get("assignments", assignmentId);
  if (!assignment || assignment.classId !== classId) {
    throw new ConvexError({
      code: "ASSIGNMENT_UNAVAILABLE",
      message: "Assignment not found or access denied",
    });
  }
  return assignment;
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

async function deleteLinksForAssignment(
  ctx: MutationCtx,
  assignmentId: Id<"assignments">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- assignment-scoped cleanup
  const links = await ctx.db
    .query("assignmentStudentLinks")
    .withIndex("by_assignment", (q) => q.eq("assignmentId", assignmentId))
    .collect();
  for (const link of links) {
    await ctx.db.delete("assignmentStudentLinks", link._id);
  }
}

async function deleteLinkedProcedureTask(
  ctx: MutationCtx,
  args: {
    classId: Id<"classes">;
    assignmentId: Id<"assignments">;
    taskId: Id<"tasks">;
  },
): Promise<void> {
  const existing = await ctx.db.get("tasks", args.taskId);
  if (!existing || existing.classId !== args.classId) {
    return;
  }
  // Allow deleting when still linked to this assignment, or previously unlinked.
  if (existing.assignmentId !== undefined && existing.assignmentId !== args.assignmentId) {
    return;
  }
  await deleteTaskWithCompletions(ctx, args.taskId);
}

async function syncProcedureTasks(
  ctx: MutationCtx,
  args: {
    classId: Id<"classes">;
    assignmentId: Id<"assignments">;
    dueDateKey: string | undefined;
    steps: Array<ProcedureStep>;
    createdBy: Id<"users">;
  },
): Promise<Array<ProcedureStep>> {
  const now = Date.now();
  const result: Array<ProcedureStep> = [];

  for (const step of args.steps) {
    if (!step.addAsTask) {
      if (step.taskId) {
        await deleteLinkedProcedureTask(ctx, {
          classId: args.classId,
          assignmentId: args.assignmentId,
          taskId: step.taskId,
        });
      }
      result.push({
        key: step.key,
        body: step.body,
        addAsTask: false,
      });
      continue;
    }

    if (step.taskId) {
      const existing = await ctx.db.get("tasks", step.taskId);
      if (existing && existing.classId === args.classId) {
        await ctx.db.patch("tasks", step.taskId, {
          name: step.body,
          dueDateKey: args.dueDateKey,
          assignmentId: args.assignmentId,
          updatedAt: now,
        });
        result.push({
          key: step.key,
          body: step.body,
          addAsTask: true,
          taskId: step.taskId,
        });
        continue;
      }
    }

    const taskId = await ctx.db.insert("tasks", {
      classId: args.classId,
      name: step.body,
      ...(args.dueDateKey !== undefined ? { dueDateKey: args.dueDateKey } : {}),
      assignmentId: args.assignmentId,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    });
    result.push({
      key: step.key,
      body: step.body,
      addAsTask: true,
      taskId,
    });
  }

  const keptTaskIds = new Set(result.flatMap((step) => (step.taskId ? [step.taskId] : [])));
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- assignment-scoped linked task cleanup
  const linkedTasks = await ctx.db
    .query("tasks")
    .withIndex("by_assignmentId", (q) => q.eq("assignmentId", args.assignmentId))
    .collect();
  for (const task of linkedTasks) {
    if (!keptTaskIds.has(task._id)) {
      await deleteTaskWithCompletions(ctx, task._id);
    }
  }

  return result;
}

async function attachProcedureTaskProgress(
  ctx: QueryCtx,
  args: {
    classId: Id<"classes">;
    steps: Doc<"assignments">["procedureSteps"];
    audienceStudentIds: Array<Id<"users">>;
  },
): Promise<
  Array<{
    key: string;
    body: string;
    addAsTask: boolean;
    taskId?: Id<"tasks">;
    taskCompletedCount?: number;
    taskStudentCount?: number;
  }>
> {
  const studentSet = new Set(args.audienceStudentIds);
  const studentCount = args.audienceStudentIds.length;
  const result = [];

  for (const step of args.steps) {
    if (!step.addAsTask || !step.taskId) {
      result.push({
        key: step.key,
        body: step.body,
        addAsTask: step.addAsTask,
        ...(step.taskId ? { taskId: step.taskId } : {}),
      });
      continue;
    }

    const task = await ctx.db.get("tasks", step.taskId);
    if (!task || task.classId !== args.classId) {
      result.push({
        key: step.key,
        body: step.body,
        addAsTask: true,
      });
      continue;
    }

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- task-scoped completions
    const completions = await ctx.db
      .query("taskCompletions")
      .withIndex("by_task", (q) => q.eq("taskId", step.taskId!))
      .collect();
    const completedCount = completions.filter((row) => studentSet.has(row.studentUserId)).length;

    result.push({
      key: step.key,
      body: step.body,
      addAsTask: true,
      taskId: step.taskId,
      taskCompletedCount: completedCount,
      taskStudentCount: studentCount,
    });
  }

  return result;
}

function toPublicLink(link: Doc<"assignmentStudentLinks">) {
  return {
    _id: link._id,
    _creationTime: link._creationTime,
    classId: link.classId,
    assignmentId: link.assignmentId,
    studentUserId: link.studentUserId,
    url: link.url,
    label: link.label,
    handedIn: link.handedIn,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
  };
}

function toPublicAssignmentBase(assignment: Doc<"assignments">) {
  return {
    _id: assignment._id,
    _creationTime: assignment._creationTime,
    classId: assignment.classId,
    name: assignment.name,
    subject: assignment.subject,
    unit: assignment.unit,
    dueDateKey: assignment.dueDateKey,
    instructionsJson: assignment.instructionsJson,
    scoringMode: assignment.scoringMode,
    totalPoints: assignment.totalPoints,
    sections: assignment.sections,
    procedureSteps: assignment.procedureSteps,
    expectationIds: assignment.expectationIds,
    acceptLinkSubmissions: assignment.acceptLinkSubmissions !== false,
    scoresReleased: assignment.scoresReleased === true,
    createdBy: assignment.createdBy,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
  };
}

function assignmentAcceptsLinkSubmissions(assignment: Doc<"assignments">): boolean {
  return assignment.acceptLinkSubmissions !== false;
}

function assertAssignmentAcceptsLinkSubmissions(assignment: Doc<"assignments">): void {
  if (!assignmentAcceptsLinkSubmissions(assignment)) {
    throw new Error("This assignment does not accept submission links");
  }
}

function hasInstructions(assignment: Doc<"assignments">): boolean {
  return Boolean(assignment.instructionsJson);
}

function hasProcedure(assignment: Doc<"assignments">): boolean {
  return assignment.procedureSteps.length > 0;
}

/**
 * List assignments for a class with hand-in stats scoped to the viewer's audience.
 */
export const list = classQuery({
  args: {},
  returns: v.array(assignmentListItemValidator),
  handler: async (ctx) => {
    const classId = ctx.classDoc._id;
    const audience = await resolveAssignmentAudience(ctx, classId);
    const studentIds =
      audience.scope === "class"
        ? audience.studentIds
        : audience.students.map((student) => student.userId);
    const studentSet = new Set(studentIds);
    const studentCount = studentIds.length;

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const docs = await ctx.db
      .query("assignments")
      .withIndex("by_classId_updatedAt", (q) => q.eq("classId", classId))
      .order("desc")
      .collect();

    const result = [];
    for (const doc of docs) {
      // eslint-disable-next-line @convex-dev/no-collect-in-query -- assignment-scoped links
      const links = await ctx.db
        .query("assignmentStudentLinks")
        .withIndex("by_assignment", (q) => q.eq("assignmentId", doc._id))
        .collect();
      const audienceLinks = links.filter((link) => studentSet.has(link.studentUserId));
      const handedInStudents = new Set(
        audienceLinks.filter((link) => link.handedIn).map((link) => link.studentUserId),
      );

      let viewerReleasedScores:
        | Array<{
            studentUserId: Id<"users">;
            totalPointsEarned?: number;
            sectionScores?: Doc<"assignmentScores">["sectionScores"];
            excused: boolean;
          }>
        | undefined;
      if (audience.scope === "personal" && doc.scoresReleased === true) {
        // eslint-disable-next-line @convex-dev/no-collect-in-query -- assignment-scoped scores
        const scores = await ctx.db
          .query("assignmentScores")
          .withIndex("by_assignment", (q) => q.eq("assignmentId", doc._id))
          .collect();
        viewerReleasedScores = scores
          .filter((score) => studentSet.has(score.studentUserId))
          .map((score) => ({
            studentUserId: score.studentUserId,
            ...(score.totalPointsEarned !== undefined
              ? { totalPointsEarned: score.totalPointsEarned }
              : {}),
            ...(score.sectionScores !== undefined ? { sectionScores: score.sectionScores } : {}),
            excused: score.excused === true,
          }));
      }

      result.push({
        ...toPublicAssignmentBase(doc),
        handedInStudentCount: handedInStudents.size,
        studentCount,
        linkCount: audienceLinks.length,
        hasInstructions: hasInstructions(doc),
        hasProcedure: hasProcedure(doc),
        ...(viewerReleasedScores !== undefined ? { viewerReleasedScores } : {}),
      });
    }
    return result;
  },
});

/**
 * Get a single assignment. Staff see all student links; students/guardians
 * receive only their pertinent students (self or linked).
 */
export const get = classQuery({
  args: {
    assignmentId: v.id("assignments"),
  },
  returns: v.union(assignmentDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const classId = ctx.classDoc._id;
    const assignment = await ctx.db.get("assignments", args.assignmentId);
    if (!assignment || assignment.classId !== classId) {
      return null;
    }

    const audience = await resolveAssignmentAudience(ctx, classId);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- assignment-scoped links
    const links = await ctx.db
      .query("assignmentStudentLinks")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", args.assignmentId))
      .collect();

    const expectationDocs = [];
    for (const expectationId of assignment.expectationIds) {
      const expectation = await ctx.db.get("expectations", expectationId);
      if (expectation && expectation.classId === classId) {
        expectationDocs.push(expectation);
      }
    }

    const audienceStudentIds =
      audience.scope === "class"
        ? audience.studentIds
        : audience.students.map((student) => student.userId);
    const procedureSteps = await attachProcedureTaskProgress(ctx, {
      classId,
      steps: assignment.procedureSteps,
      audienceStudentIds,
    });
    const base = {
      ...toPublicAssignmentBase(assignment),
      procedureSteps,
    };

    if (audience.scope === "class") {
      const studentSet = new Set(audience.studentIds);
      return {
        ...base,
        scope: "class" as const,
        studentCount: audience.studentIds.length,
        links: links.filter((link) => studentSet.has(link.studentUserId)).map(toPublicLink),
        expectations: expectationDocs.map((expectation) => ({
          _id: expectation._id,
          name: expectation.name,
          unit: expectation.unit,
          inputType: expectation.inputType,
        })),
      };
    }

    const students = [];
    for (const student of audience.students) {
      const studentLinks = links
        .filter((link) => link.studentUserId === student.userId)
        .map(toPublicLink);

      const roster = await ctx.db
        .query("studentRosters")
        .withIndex("by_classId_userId", (q) =>
          q.eq("classId", classId).eq("userId", student.userId),
        )
        .unique();

      const expectations = [];
      for (const expectation of expectationDocs) {
        const value = await ctx.db
          .query("expectationValues")
          .withIndex("by_expectation_student", (q) =>
            q.eq("expectationId", expectation._id).eq("studentUserId", student.userId),
          )
          .unique();
        expectations.push({
          _id: expectation._id,
          name: expectation.name,
          unit: expectation.unit,
          inputType: expectation.inputType,
          ...(value?.numberValue !== undefined ? { numberValue: value.numberValue } : {}),
          ...(value?.rangeMin !== undefined ? { rangeMin: value.rangeMin } : {}),
          ...(value?.rangeMax !== undefined ? { rangeMax: value.rangeMax } : {}),
        });
      }

      students.push({
        userId: student.userId,
        ...(student.name ? { name: student.name } : {}),
        ...(roster?.firstName ? { firstName: roster.firstName } : {}),
        ...(roster?.lastName ? { lastName: roster.lastName } : {}),
        links: studentLinks,
        expectations,
        canEditLinks: student.canEditLinks,
      });
    }

    return {
      ...base,
      scope: "personal" as const,
      students,
    };
  },
});

export const create = classMutation({
  args: {
    name: v.string(),
    subject: v.optional(v.string()),
    unit: v.optional(v.string()),
    dueDateKey: v.optional(v.string()),
    instructionsJson: v.optional(v.string()),
    scoringMode: v.union(v.literal("total"), v.literal("sections")),
    totalPoints: v.optional(v.number()),
    sections: v.optional(v.array(sectionInputValidator)),
    procedureSteps: v.optional(v.array(procedureStepInputValidator)),
    expectationIds: v.optional(v.array(v.id("expectations"))),
    acceptLinkSubmissions: v.boolean(),
  },
  returns: v.id("assignments"),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "assignmentCreate", { key: ctx.userId, throws: true });
    await ctx.require("assignments:manage");

    const classId = ctx.classDoc._id;
    const name = normalizeName(args.name);
    const subject = normalizeOptionalLabel(args.subject, "Subject", MAX_SUBJECT_LENGTH);
    const unit = normalizeOptionalLabel(args.unit, "Unit", MAX_UNIT_LENGTH);
    const dueDateKey = normalizeOptionalDueDateKey(args.dueDateKey);
    const instructionsJson = normalizeOptionalInstructionsJson(args.instructionsJson);
    const scoring = normalizeSections(args.scoringMode, args.totalPoints, args.sections);
    const procedureSteps = normalizeProcedureSteps(args.procedureSteps);
    const expectationIds = await normalizeExpectationIds(ctx, classId, args.expectationIds ?? []);
    const now = Date.now();

    const assignmentId = await ctx.db.insert("assignments", {
      classId,
      name,
      ...(subject !== undefined ? { subject } : {}),
      ...(unit !== undefined ? { unit } : {}),
      ...(dueDateKey !== undefined ? { dueDateKey } : {}),
      ...(instructionsJson !== undefined ? { instructionsJson } : {}),
      scoringMode: scoring.scoringMode,
      ...(scoring.totalPoints !== undefined ? { totalPoints: scoring.totalPoints } : {}),
      ...(scoring.sections !== undefined ? { sections: scoring.sections } : {}),
      procedureSteps,
      expectationIds,
      acceptLinkSubmissions: args.acceptLinkSubmissions,
      scoresReleased: false,
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });

    const syncedSteps = await syncProcedureTasks(ctx, {
      classId,
      assignmentId,
      dueDateKey,
      steps: procedureSteps,
      createdBy: ctx.userId,
    });
    await ctx.db.patch("assignments", assignmentId, {
      procedureSteps: syncedSteps,
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "assignment",
      resourceId: assignmentId,
      summary: `Created assignment "${name}"`,
      summaryKey: "activitySummary_createdAssignment",
      metadata: { name },
    });

    return assignmentId;
  },
});

export const update = classMutation({
  args: {
    assignmentId: v.id("assignments"),
    name: v.string(),
    subject: v.optional(v.string()),
    unit: v.optional(v.string()),
    dueDateKey: v.optional(v.string()),
    instructionsJson: v.optional(v.string()),
    scoringMode: v.union(v.literal("total"), v.literal("sections")),
    totalPoints: v.optional(v.number()),
    sections: v.optional(v.array(sectionInputValidator)),
    procedureSteps: v.optional(v.array(procedureStepInputValidator)),
    expectationIds: v.optional(v.array(v.id("expectations"))),
    acceptLinkSubmissions: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "assignmentUpdate", { key: ctx.userId, throws: true });
    await ctx.require("assignments:manage");

    const classId = ctx.classDoc._id;
    await requireAssignmentInClass(ctx, classId, args.assignmentId);
    const name = normalizeName(args.name);
    const subject = normalizeOptionalLabel(args.subject, "Subject", MAX_SUBJECT_LENGTH);
    const unit = normalizeOptionalLabel(args.unit, "Unit", MAX_UNIT_LENGTH);
    const dueDateKey = normalizeOptionalDueDateKey(args.dueDateKey);
    const instructionsJson = normalizeOptionalInstructionsJson(args.instructionsJson);
    const scoring = normalizeSections(args.scoringMode, args.totalPoints, args.sections);
    const procedureSteps = normalizeProcedureSteps(args.procedureSteps);
    const expectationIds = await normalizeExpectationIds(ctx, classId, args.expectationIds ?? []);
    const syncedSteps = await syncProcedureTasks(ctx, {
      classId,
      assignmentId: args.assignmentId,
      dueDateKey,
      steps: procedureSteps,
      createdBy: ctx.userId,
    });

    await ctx.db.patch("assignments", args.assignmentId, {
      name,
      subject,
      unit,
      dueDateKey,
      instructionsJson,
      scoringMode: scoring.scoringMode,
      totalPoints: scoring.totalPoints,
      sections: scoring.sections,
      procedureSteps: syncedSteps,
      expectationIds,
      acceptLinkSubmissions: args.acceptLinkSubmissions,
      updatedAt: Date.now(),
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "assignment",
      resourceId: args.assignmentId,
      summary: `Updated assignment "${name}"`,
      summaryKey: "activitySummary_updatedAssignment",
      metadata: { name },
    });

    return null;
  },
});

export const remove = classMutation({
  args: {
    assignmentId: v.id("assignments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "assignmentRemove", { key: ctx.userId, throws: true });
    await ctx.require("assignments:manage");

    const classId = ctx.classDoc._id;
    const existing = await requireAssignmentInClass(ctx, classId, args.assignmentId);
    await deleteLinksForAssignment(ctx, args.assignmentId);
    await deleteScoresForAssignment(ctx, args.assignmentId);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- assignment-scoped linked tasks
    const linkedTasks = await ctx.db
      .query("tasks")
      .withIndex("by_assignmentId", (q) => q.eq("assignmentId", args.assignmentId))
      .collect();
    for (const task of linkedTasks) {
      await deleteTaskWithCompletions(ctx, task._id);
    }

    await ctx.db.delete("assignments", args.assignmentId);

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "assignment",
      resourceId: args.assignmentId,
      summary: `Deleted assignment "${existing.name}"`,
      summaryKey: "activitySummary_deletedAssignment",
      metadata: { name: existing.name },
    });

    return null;
  },
});

export const addLink = classMutation({
  args: {
    assignmentId: v.id("assignments"),
    url: v.string(),
    label: v.optional(v.string()),
  },
  returns: v.id("assignmentStudentLinks"),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "assignmentLinkAdd", { key: ctx.userId, throws: true });

    const classId = ctx.classDoc._id;
    const assignment = await requireAssignmentInClass(ctx, classId, args.assignmentId);
    assertAssignmentAcceptsLinkSubmissions(assignment);
    await requireStudentInClass(ctx, classId, ctx.userId);

    const url = normalizeUrl(args.url);
    const label = normalizeOptionalLabel(args.label, "Label", MAX_LINK_LABEL_LENGTH);
    const now = Date.now();

    const linkId = await ctx.db.insert("assignmentStudentLinks", {
      classId,
      assignmentId: args.assignmentId,
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
      resourceType: "assignmentLink",
      resourceId: linkId,
      summary: `Added submission link for "${assignment.name}"`,
      summaryKey: "activitySummary_addedAssignmentLink",
      metadata: {
        name: assignment.name,
        assignmentId: args.assignmentId,
      },
    });

    return linkId;
  },
});

export const updateLink = classMutation({
  args: {
    linkId: v.id("assignmentStudentLinks"),
    url: v.string(),
    label: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "assignmentLinkUpdate", { key: ctx.userId, throws: true });

    const classId = ctx.classDoc._id;
    const link = await ctx.db.get("assignmentStudentLinks", args.linkId);
    if (!link || link.classId !== classId) {
      throw new ConvexError({
        code: "ASSIGNMENT_UNAVAILABLE",
        message: "Link not found or access denied",
      });
    }
    if (link.studentUserId !== ctx.userId) {
      throw new Error("You can only edit your own links");
    }
    const assignment = await requireAssignmentInClass(ctx, classId, link.assignmentId);
    assertAssignmentAcceptsLinkSubmissions(assignment);

    const url = normalizeUrl(args.url);
    const label = normalizeOptionalLabel(args.label, "Label", MAX_LINK_LABEL_LENGTH);

    await ctx.db.patch("assignmentStudentLinks", args.linkId, {
      url,
      label,
      updatedAt: Date.now(),
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "assignmentLink",
      resourceId: args.linkId,
      summary: `Updated submission link for "${assignment.name}"`,
      summaryKey: "activitySummary_updatedAssignmentLink",
      metadata: {
        name: assignment.name,
        assignmentId: link.assignmentId,
      },
    });

    return null;
  },
});

export const removeLink = classMutation({
  args: {
    linkId: v.id("assignmentStudentLinks"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "assignmentLinkRemove", { key: ctx.userId, throws: true });

    const classId = ctx.classDoc._id;
    const link = await ctx.db.get("assignmentStudentLinks", args.linkId);
    if (!link || link.classId !== classId) {
      throw new ConvexError({
        code: "ASSIGNMENT_UNAVAILABLE",
        message: "Link not found or access denied",
      });
    }
    if (link.studentUserId !== ctx.userId) {
      throw new Error("You can only remove your own links");
    }

    const assignment = await ctx.db.get("assignments", link.assignmentId);
    const assignmentName = assignment?.name ?? "assignment";
    await ctx.db.delete("assignmentStudentLinks", args.linkId);

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "assignmentLink",
      resourceId: args.linkId,
      summary: `Removed submission link for "${assignmentName}"`,
      summaryKey: "activitySummary_removedAssignmentLink",
      metadata: {
        name: assignmentName,
        assignmentId: link.assignmentId,
      },
    });

    return null;
  },
});

export const setLinkHandedIn = classMutation({
  args: {
    linkId: v.id("assignmentStudentLinks"),
    handedIn: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "assignmentLinkSetHandedIn", {
      key: ctx.userId,
      throws: true,
    });

    const classId = ctx.classDoc._id;
    const link = await ctx.db.get("assignmentStudentLinks", args.linkId);
    if (!link || link.classId !== classId) {
      throw new ConvexError({
        code: "ASSIGNMENT_UNAVAILABLE",
        message: "Link not found or access denied",
      });
    }
    if (link.studentUserId !== ctx.userId) {
      throw new Error("You can only update your own links");
    }
    const assignment = await requireAssignmentInClass(ctx, classId, link.assignmentId);
    assertAssignmentAcceptsLinkSubmissions(assignment);

    await ctx.db.patch("assignmentStudentLinks", args.linkId, {
      handedIn: args.handedIn,
      updatedAt: Date.now(),
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "assignmentLink",
      resourceId: args.linkId,
      summary: args.handedIn
        ? `Marked submission handed in for "${assignment.name}"`
        : `Unmarked submission handed in for "${assignment.name}"`,
      summaryKey: args.handedIn
        ? "activitySummary_markedAssignmentLinkHandedIn"
        : "activitySummary_unmarkedAssignmentLinkHandedIn",
      metadata: {
        name: assignment.name,
        assignmentId: link.assignmentId,
        handedIn: String(args.handedIn),
      },
    });

    return null;
  },
});

/** Exported for tests / shared empty doc constant. */
export const EMPTY_ASSIGNMENT_INSTRUCTIONS_JSON = EMPTY_INSTRUCTIONS_JSON;
