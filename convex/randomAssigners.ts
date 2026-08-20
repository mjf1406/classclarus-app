import { ConvexError, v } from "convex/values";

import { APP_CONFIG } from "./appConfig.js";
import { components } from "./_generated/api.js";
import type { Doc, Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { buildEquitableRosterMatrixCounts } from "./lib/assigners/equitableRosterMatrix.js";
import { assignRandom, type RandomAssignRecipient } from "./lib/assigners/randomAssign.js";
import {
  randomAssignerFormSchemaEn,
  type RandomAssignerFormValues,
} from "./lib/assigners/randomAssignerSchema.js";
import {
  assignerRunAssignmentValidator,
  projectAssignerRunAssignments,
} from "./lib/assigners/runAssignmentProjection.js";
import { authz } from "./authz.js";
import { classScope } from "./lib/authzModel.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { authedQuery, classMutation, classQuery } from "./lib/customFunctions.js";
import {
  formatRosterNameParts,
  resolveRosterNameFormat,
  type RosterNameFormat,
} from "./lib/rosterNameFormat.js";

const scopeValidator = v.union(v.literal("class"), v.literal("groups"));

const randomAssignerListItemValidator = v.object({
  _id: v.id("randomAssigners"),
  _creationTime: v.number(),
  name: v.string(),
  items: v.array(v.string()),
  defaultReplicates: v.boolean(),
  defaultScope: scopeValidator,
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
  runCount: v.number(),
  latestRunId: v.union(v.id("randomAssignerRuns"), v.null()),
  latestRunAt: v.union(v.number(), v.null()),
});

const randomAssignerDetailValidator = v.object({
  _id: v.id("randomAssigners"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  name: v.string(),
  items: v.array(v.string()),
  defaultReplicates: v.boolean(),
  defaultScope: scopeValidator,
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const randomAssignerRunListItemValidator = v.object({
  _id: v.id("randomAssignerRuns"),
  _creationTime: v.number(),
  assignerId: v.id("randomAssigners"),
  ranAt: v.number(),
  ranBy: v.id("users"),
  scope: scopeValidator,
  replicates: v.boolean(),
  assignmentCount: v.number(),
});

const randomAssignerRunDetailValidator = v.object({
  _id: v.id("randomAssignerRuns"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  assignerId: v.id("randomAssigners"),
  assignerName: v.string(),
  ranAt: v.number(),
  ranBy: v.id("users"),
  scope: scopeValidator,
  replicates: v.boolean(),
  itemsSnapshot: v.array(v.string()),
  assignments: v.array(assignerRunAssignmentValidator),
});

const randomAssignerDisplayRunValidator = v.object({
  _id: v.id("randomAssignerRuns"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  assignerId: v.id("randomAssigners"),
  assignerName: v.string(),
  ranAt: v.number(),
  ranBy: v.id("users"),
  scope: scopeValidator,
  replicates: v.boolean(),
  itemsSnapshot: v.array(v.string()),
  assignments: v.array(assignerRunAssignmentValidator),
  nameFormat: v.object({
    order: v.union(v.literal("firstLast"), v.literal("lastFirst")),
    space: v.boolean(),
  }),
});

const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 50;

const randomHistoryItemValidator = v.object({
  runId: v.id("randomAssignerRuns"),
  ranAt: v.number(),
  item: v.string(),
});

const randomRosterMatrixStudentValidator = v.object({
  userId: v.id("users"),
  rosterNumber: v.number(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  email: v.optional(v.string()),
});

const randomRosterMatrixCountValidator = v.object({
  item: v.string(),
  count: v.number(),
});

const randomRosterMatrixRowValidator = v.object({
  studentUserId: v.id("users"),
  counts: v.array(randomRosterMatrixCountValidator),
});

const randomRosterMatrixValidator = v.object({
  items: v.array(v.string()),
  students: v.array(randomRosterMatrixStudentValidator),
  countsByStudent: v.array(randomRosterMatrixRowValidator),
});

function parseFormInput(input: {
  name: string;
  items: string[];
  defaultReplicates: boolean;
  defaultScope: "class" | "groups";
}): RandomAssignerFormValues {
  const parsed = randomAssignerFormSchemaEn.safeParse(input);
  if (!parsed.success) {
    throw new ConvexError({
      code: "INVALID_INPUT",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    });
  }
  return parsed.data;
}

async function requireRandomAssigner(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  assignerId: Id<"randomAssigners">,
): Promise<Doc<"randomAssigners">> {
  const assigner = await ctx.db.get("randomAssigners", assignerId);
  if (!assigner || assigner.classId !== classId) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Random assigner not found",
    });
  }
  return assigner;
}

async function requireRandomAssignerRun(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  assignerId: Id<"randomAssigners">,
  runId: Id<"randomAssignerRuns">,
): Promise<Doc<"randomAssignerRuns">> {
  const run = await ctx.db.get("randomAssignerRuns", runId);
  if (!run || run.classId !== classId || run.assignerId !== assignerId) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Assignment run not found",
    });
  }
  return run;
}

function studentDisplayName(
  user: Doc<"users"> | null,
  roster: { firstName?: string; lastName?: string } | undefined,
  format: RosterNameFormat,
  userId: Id<"users">,
): string {
  const rosterName = formatRosterNameParts(roster?.firstName, roster?.lastName, format);
  if (rosterName) return rosterName;
  const accountName = user?.name?.trim();
  if (accountName) return accountName;
  const email = user?.email?.trim();
  if (email) return email;
  return userId;
}

async function loadRecipientsForRun(
  ctx: MutationCtx,
  classId: Id<"classes">,
  scope: "class" | "groups",
): Promise<
  Array<
    RandomAssignRecipient & {
      displayName: string;
      rosterNumber: number | undefined;
      firstName: string | undefined;
      lastName: string | undefined;
    }
  >
> {
  const classDoc = await ctx.db.get("classes", classId);
  if (!classDoc) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Class not found" });
  }
  const nameFormat = resolveRosterNameFormat(classDoc);

  const studentEntries = await ctx.runQuery(components.authz.queries.getUsersWithRole, {
    tenantId: APP_CONFIG.authzTenantId,
    role: "student",
    scope: { type: "class", id: classId },
  });
  const studentIds = studentEntries.map((entry: { userId: string }) => entry.userId as Id<"users">);

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded roster
  const rosterRows = await ctx.db
    .query("studentRosters")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  const rosterByUserId = new Map(
    rosterRows.map(
      (row) =>
        [
          row.userId,
          {
            firstName: row.firstName,
            lastName: row.lastName,
            rosterNumber: row.rosterNumber,
          },
        ] as const,
    ),
  );

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded memberships
  const membershipDocs = await ctx.db
    .query("groupMemberships")
    .withIndex("by_class", (q) => q.eq("classId", classId))
    .collect();
  const membershipByStudent = new Map(
    membershipDocs.map((row) => [row.studentUserId, row] as const),
  );

  const groupNameById = new Map<string, string>();
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded groups
  const groupDocs = await ctx.db
    .query("groups")
    .withIndex("by_class", (q) => q.eq("classId", classId))
    .collect();
  for (const group of groupDocs) {
    groupNameById.set(group._id, group.name);
  }

  const recipients: Array<
    RandomAssignRecipient & {
      displayName: string;
      rosterNumber: number | undefined;
      firstName: string | undefined;
      lastName: string | undefined;
    }
  > = [];
  for (const userId of studentIds) {
    const user = await ctx.db.get("users", userId);
    const roster = rosterByUserId.get(userId);
    const displayName = studentDisplayName(user, roster, nameFormat, userId);
    const membership = membershipByStudent.get(userId);

    if (scope === "groups") {
      if (!membership) continue;
      recipients.push({
        studentUserId: userId,
        displayName,
        rosterNumber: roster?.rosterNumber,
        firstName: roster?.firstName,
        lastName: roster?.lastName,
        groupId: membership.groupId,
        groupName: groupNameById.get(membership.groupId),
      });
    } else {
      recipients.push({
        studentUserId: userId,
        displayName,
        rosterNumber: roster?.rosterNumber,
        firstName: roster?.firstName,
        lastName: roster?.lastName,
        groupId: membership?.groupId,
        groupName: membership ? groupNameById.get(membership.groupId) : undefined,
      });
    }
  }

  return recipients;
}

type RosterStudentRow = {
  userId: Id<"users">;
  displayName: string;
  rosterNumber?: number;
  firstName?: string;
  lastName?: string;
  image?: string;
  email?: string;
};

async function loadRosterStudents(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
): Promise<RosterStudentRow[]> {
  const classDoc = await ctx.db.get("classes", classId);
  if (!classDoc) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Class not found" });
  }
  const nameFormat = resolveRosterNameFormat(classDoc);

  const studentEntries = await ctx.runQuery(components.authz.queries.getUsersWithRole, {
    tenantId: APP_CONFIG.authzTenantId,
    role: "student",
    scope: { type: "class", id: classId },
  });
  const studentIds = studentEntries.map((entry: { userId: string }) => entry.userId as Id<"users">);

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded roster
  const rosterRows = await ctx.db
    .query("studentRosters")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  const rosterByUserId = new Map(rosterRows.map((row) => [row.userId, row] as const));

  const students: RosterStudentRow[] = [];
  for (const userId of studentIds) {
    const user = await ctx.db.get("users", userId);
    const roster = rosterByUserId.get(userId);
    students.push({
      userId,
      displayName: studentDisplayName(user, roster, nameFormat, userId),
      rosterNumber: roster?.rosterNumber,
      firstName: roster?.firstName,
      lastName: roster?.lastName,
      image: user?.image,
      email: user?.email,
    });
  }

  students.sort((a, b) => {
    const aNum = a.rosterNumber ?? Number.MAX_SAFE_INTEGER;
    const bNum = b.rosterNumber ?? Number.MAX_SAFE_INTEGER;
    if (aNum !== bNum) return aNum - bNum;
    return a.displayName.localeCompare(b.displayName);
  });

  return students;
}

async function loadPriorAssignments(
  ctx: QueryCtx | MutationCtx,
  assignerId: Id<"randomAssigners">,
): Promise<Array<{ studentUserId: string; item: string }>> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded history
  const runs = await ctx.db
    .query("randomAssignerRuns")
    .withIndex("by_assignerId_ranAt", (q) => q.eq("assignerId", assignerId))
    .order("asc")
    .collect();
  const prior: Array<{ studentUserId: string; item: string }> = [];
  for (const run of runs) {
    for (const assignment of run.assignments) {
      prior.push({
        studentUserId: assignment.studentUserId,
        item: assignment.item,
      });
    }
  }
  return prior;
}

async function loadStudentPriorAssignments(
  ctx: QueryCtx | MutationCtx,
  assignerId: Id<"randomAssigners">,
  studentUserId: Id<"users">,
): Promise<
  Array<{
    item: string;
    ranAt: number;
    runId: Id<"randomAssignerRuns">;
  }>
> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded history
  const runs = await ctx.db
    .query("randomAssignerRuns")
    .withIndex("by_assignerId_ranAt", (q) => q.eq("assignerId", assignerId))
    .order("desc")
    .collect();

  const prior: Array<{
    item: string;
    ranAt: number;
    runId: Id<"randomAssignerRuns">;
  }> = [];

  for (const run of runs) {
    for (const assignment of run.assignments) {
      if (assignment.studentUserId !== studentUserId) continue;
      prior.push({
        item: assignment.item,
        ranAt: run.ranAt,
        runId: run._id,
      });
    }
  }

  return prior;
}

async function latestRunForAssigner(
  ctx: QueryCtx | MutationCtx,
  assignerId: Id<"randomAssigners">,
): Promise<Doc<"randomAssignerRuns"> | null> {
  const run = await ctx.db
    .query("randomAssignerRuns")
    .withIndex("by_assignerId_ranAt", (q) => q.eq("assignerId", assignerId))
    .order("desc")
    .first();
  return run ?? null;
}

export const listForClass = classQuery({
  args: {},
  returns: v.array(randomAssignerListItemValidator),
  handler: async (ctx) => {
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const rows = await ctx.db
      .query("randomAssigners")
      .withIndex("by_classId", (q) => q.eq("classId", ctx.classDoc._id))
      .collect();
    rows.sort((a, b) => a.name.localeCompare(b.name));

    const result = [];
    for (const row of rows) {
      // eslint-disable-next-line @convex-dev/no-collect-in-query -- per-assigner run count, classroom-bounded
      const runs = await ctx.db
        .query("randomAssignerRuns")
        .withIndex("by_assignerId", (q) => q.eq("assignerId", row._id))
        .collect();
      const latest = await latestRunForAssigner(ctx, row._id);
      result.push({
        _id: row._id,
        _creationTime: row._creationTime,
        name: row.name,
        items: row.items,
        defaultReplicates: row.defaultReplicates,
        defaultScope: row.defaultScope,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        runCount: runs.length,
        latestRunId: latest?._id ?? null,
        latestRunAt: latest?.ranAt ?? null,
      });
    }
    return result;
  },
});

export const get = classQuery({
  args: { assignerId: v.id("randomAssigners") },
  returns: randomAssignerDetailValidator,
  handler: async (ctx, args) => {
    const assigner = await requireRandomAssigner(ctx, ctx.classDoc._id, args.assignerId);
    return {
      _id: assigner._id,
      _creationTime: assigner._creationTime,
      classId: assigner.classId,
      name: assigner.name,
      items: assigner.items,
      defaultReplicates: assigner.defaultReplicates,
      defaultScope: assigner.defaultScope,
      createdBy: assigner.createdBy,
      createdAt: assigner.createdAt,
      updatedAt: assigner.updatedAt,
    };
  },
});

export const listRuns = classQuery({
  args: { assignerId: v.id("randomAssigners") },
  returns: v.array(randomAssignerRunListItemValidator),
  handler: async (ctx, args) => {
    await requireRandomAssigner(ctx, ctx.classDoc._id, args.assignerId);
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded history
    const runs = await ctx.db
      .query("randomAssignerRuns")
      .withIndex("by_assignerId_ranAt", (q) => q.eq("assignerId", args.assignerId))
      .order("desc")
      .collect();
    return runs.map((run) => ({
      _id: run._id,
      _creationTime: run._creationTime,
      assignerId: run.assignerId,
      ranAt: run.ranAt,
      ranBy: run.ranBy,
      scope: run.scope,
      replicates: run.replicates,
      assignmentCount: run.assignments.length,
    }));
  },
});

export const getRun = classQuery({
  args: {
    assignerId: v.id("randomAssigners"),
    runId: v.id("randomAssignerRuns"),
  },
  returns: randomAssignerRunDetailValidator,
  handler: async (ctx, args) => {
    const assigner = await requireRandomAssigner(ctx, ctx.classDoc._id, args.assignerId);
    const run = await requireRandomAssignerRun(ctx, ctx.classDoc._id, args.assignerId, args.runId);
    const canReadStudents = await ctx.can("students:read");
    return {
      _id: run._id,
      _creationTime: run._creationTime,
      classId: run.classId,
      assignerId: run.assignerId,
      assignerName: assigner.name,
      ranAt: run.ranAt,
      ranBy: run.ranBy,
      scope: run.scope,
      replicates: run.replicates,
      itemsSnapshot: run.itemsSnapshot,
      assignments: projectAssignerRunAssignments(run.assignments, canReadStudents),
    };
  },
});

/** Display route `/d/$runId` — lookup by run id without class layout context. */
export const getRunById = authedQuery({
  args: { runId: v.id("randomAssignerRuns") },
  returns: v.union(randomAssignerDisplayRunValidator, v.null()),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("randomAssignerRuns", args.runId);
    if (!run) return null;
    const canRead = await authz.can(ctx, ctx.userId, "class:read", classScope(run.classId));
    if (!canRead) return null;
    const assigner = await ctx.db.get("randomAssigners", run.assignerId);
    if (!assigner || assigner.classId !== run.classId) return null;
    const classDoc = await ctx.db.get("classes", run.classId);
    if (!classDoc) return null;
    const canReadStudents = await authz.can(
      ctx,
      ctx.userId,
      "students:read",
      classScope(run.classId),
    );
    return {
      _id: run._id,
      _creationTime: run._creationTime,
      classId: run.classId,
      assignerId: run.assignerId,
      assignerName: assigner.name,
      ranAt: run.ranAt,
      ranBy: run.ranBy,
      scope: run.scope,
      replicates: run.replicates,
      itemsSnapshot: run.itemsSnapshot,
      assignments: projectAssignerRunAssignments(run.assignments, canReadStudents),
      nameFormat: resolveRosterNameFormat(classDoc),
    };
  },
});

export const create = classMutation({
  args: {
    name: v.string(),
    items: v.array(v.string()),
    defaultReplicates: v.boolean(),
    defaultScope: scopeValidator,
  },
  returns: v.id("randomAssigners"),
  handler: async (ctx, args) => {
    await ctx.require("assigners:manage");
    const parsed = parseFormInput(args);
    const now = Date.now();
    const assignerId = await ctx.db.insert("randomAssigners", {
      classId: ctx.classDoc._id,
      name: parsed.name,
      items: parsed.items,
      defaultReplicates: parsed.defaultReplicates,
      defaultScope: parsed.defaultScope,
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "randomAssigner",
      resourceId: assignerId,
      summary: `Created random assigner "${parsed.name}"`,
      summaryKey: "activitySummary_createdRandomAssigner",
      metadata: { name: parsed.name },
    });

    return assignerId;
  },
});

export const update = classMutation({
  args: {
    assignerId: v.id("randomAssigners"),
    name: v.string(),
    items: v.array(v.string()),
    defaultReplicates: v.boolean(),
    defaultScope: scopeValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("assigners:manage");
    const existing = await requireRandomAssigner(ctx, ctx.classDoc._id, args.assignerId);
    const parsed = parseFormInput(args);
    await ctx.db.patch("randomAssigners", existing._id, {
      name: parsed.name,
      items: parsed.items,
      defaultReplicates: parsed.defaultReplicates,
      defaultScope: parsed.defaultScope,
      updatedAt: Date.now(),
    });

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "randomAssigner",
      resourceId: existing._id,
      summary: `Updated random assigner "${parsed.name}"`,
      summaryKey: "activitySummary_updatedRandomAssigner",
      metadata: { name: parsed.name },
    });

    return null;
  },
});

export const remove = classMutation({
  args: { assignerId: v.id("randomAssigners") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("assigners:manage");
    const existing = await requireRandomAssigner(ctx, ctx.classDoc._id, args.assignerId);
    const name = existing.name;

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded cleanup
    const runs = await ctx.db
      .query("randomAssignerRuns")
      .withIndex("by_assignerId", (q) => q.eq("assignerId", existing._id))
      .collect();
    for (const run of runs) {
      await ctx.db.delete("randomAssignerRuns", run._id);
    }
    await ctx.db.delete("randomAssigners", existing._id);

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "randomAssigner",
      resourceId: args.assignerId,
      summary: `Deleted random assigner "${name}"`,
      summaryKey: "activitySummary_deletedRandomAssigner",
      metadata: { name },
    });

    return null;
  },
});

export const run = classMutation({
  args: {
    assignerId: v.id("randomAssigners"),
    scope: scopeValidator,
    replicates: v.boolean(),
  },
  returns: v.id("randomAssignerRuns"),
  handler: async (ctx, args) => {
    await ctx.require("assigners:manage");
    const assigner = await requireRandomAssigner(ctx, ctx.classDoc._id, args.assignerId);
    if (assigner.items.length === 0) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "Add at least one item before running",
      });
    }

    const recipients = await loadRecipientsForRun(ctx, ctx.classDoc._id, args.scope);
    if (recipients.length === 0) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message:
          args.scope === "groups" ? "No grouped students to assign" : "No students to assign",
      });
    }

    const rawAssignments = assignRandom({
      items: assigner.items,
      recipients,
      scope: args.scope,
      replicates: args.replicates,
    });

    const assignments = rawAssignments.map((row) => {
      const recipient = recipients.find((r) => r.studentUserId === row.studentUserId);
      return {
        studentUserId: row.studentUserId as Id<"users">,
        studentDisplayName: recipient?.displayName ?? row.studentUserId,
        item: row.item,
        rosterNumber: recipient?.rosterNumber,
        firstName: recipient?.firstName,
        lastName: recipient?.lastName,
        groupId: row.groupId as Id<"groups"> | undefined,
        groupName: row.groupName,
      };
    });

    const now = Date.now();
    const runId = await ctx.db.insert("randomAssignerRuns", {
      classId: ctx.classDoc._id,
      assignerId: assigner._id,
      ranAt: now,
      ranBy: ctx.userId,
      scope: args.scope,
      replicates: args.replicates,
      itemsSnapshot: [...assigner.items],
      assignments,
    });

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "randomAssigner",
      resourceId: runId,
      summary: `Ran random assigner "${assigner.name}"`,
      summaryKey: "activitySummary_ranRandomAssigner",
      metadata: { name: assigner.name },
    });

    return runId;
  },
});

export const removeRun = classMutation({
  args: {
    assignerId: v.id("randomAssigners"),
    runId: v.id("randomAssignerRuns"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("assigners:manage");
    const assigner = await requireRandomAssigner(ctx, ctx.classDoc._id, args.assignerId);
    await requireRandomAssignerRun(ctx, ctx.classDoc._id, args.assignerId, args.runId);
    await ctx.db.delete("randomAssignerRuns", args.runId);

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "randomAssigner",
      resourceId: args.runId,
      summary: `Deleted assignment run for "${assigner.name}"`,
      summaryKey: "activitySummary_deletedRandomAssignerRun",
      metadata: { name: assigner.name },
    });

    return null;
  },
});

export const studentHistory = classQuery({
  args: {
    assignerId: v.id("randomAssigners"),
    studentUserId: v.id("users"),
    item: v.string(),
    beforeRanAt: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    items: v.array(randomHistoryItemValidator),
    nextBeforeRanAt: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    await ctx.require("assigners:manage");
    await requireRandomAssigner(ctx, ctx.classDoc._id, args.assignerId);

    const limit = Math.min(
      Math.max(1, Math.floor(args.limit ?? DEFAULT_HISTORY_LIMIT)),
      MAX_HISTORY_LIMIT,
    );

    const prior = await loadStudentPriorAssignments(ctx, args.assignerId, args.studentUserId);
    const filtered = prior.filter((row) => {
      if (row.item !== args.item) return false;
      if (args.beforeRanAt !== undefined && row.ranAt >= args.beforeRanAt) return false;
      return true;
    });

    const items = filtered.slice(0, limit).map((row) => ({
      runId: row.runId,
      ranAt: row.ranAt,
      item: row.item,
    }));

    const last = filtered.at(limit - 1);
    return {
      items,
      ...(filtered.length > limit && last ? { nextBeforeRanAt: last.ranAt } : {}),
    };
  },
});

export const rosterMatrix = classQuery({
  args: {
    assignerId: v.id("randomAssigners"),
  },
  returns: randomRosterMatrixValidator,
  handler: async (ctx, args) => {
    await ctx.require("assigners:manage");
    const assigner = await requireRandomAssigner(ctx, ctx.classDoc._id, args.assignerId);
    const students = await loadRosterStudents(ctx, ctx.classDoc._id);
    const priorRows = await loadPriorAssignments(ctx, assigner._id);
    const studentUserIds = students.map((student) => student.userId);
    const countsByStudent = buildEquitableRosterMatrixCounts(
      assigner.items,
      studentUserIds,
      priorRows,
    );

    return {
      items: assigner.items,
      students: students.map((student) => ({
        userId: student.userId,
        rosterNumber: student.rosterNumber ?? Number.MAX_SAFE_INTEGER,
        ...(student.firstName !== undefined ? { firstName: student.firstName } : {}),
        ...(student.lastName !== undefined ? { lastName: student.lastName } : {}),
        name: student.displayName,
        ...(student.image !== undefined ? { image: student.image } : {}),
        ...(student.email !== undefined ? { email: student.email } : {}),
      })),
      countsByStudent,
    };
  },
});
