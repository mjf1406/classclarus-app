import { ConvexError, v } from "convex/values";

import { APP_CONFIG } from "./appConfig.js";
import { components } from "./_generated/api.js";
import type { Doc, Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { assignRandom, type RandomAssignRecipient } from "./lib/assigners/randomAssign.js";
import {
  randomAssignerFormSchemaEn,
  type RandomAssignerFormValues,
} from "./lib/assigners/randomAssignerSchema.js";
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

const assignmentValidator = v.object({
  studentUserId: v.id("users"),
  studentDisplayName: v.string(),
  item: v.string(),
  rosterNumber: v.optional(v.number()),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  groupId: v.optional(v.id("groups")),
  groupName: v.optional(v.string()),
});

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
  assignments: v.array(assignmentValidator),
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
  assignments: v.array(assignmentValidator),
  nameFormat: v.object({
    order: v.union(v.literal("firstLast"), v.literal("lastFirst")),
    space: v.boolean(),
  }),
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
    await ctx.require("assigners:read");
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
    await ctx.require("assigners:read");
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
    await ctx.require("assigners:read");
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
    await ctx.require("assigners:read");
    const assigner = await requireRandomAssigner(ctx, ctx.classDoc._id, args.assignerId);
    const run = await requireRandomAssignerRun(ctx, ctx.classDoc._id, args.assignerId, args.runId);
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
      assignments: run.assignments,
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
    const canRead = await authz.can(ctx, ctx.userId, "assigners:read", classScope(run.classId));
    if (!canRead) return null;
    const assigner = await ctx.db.get("randomAssigners", run.assignerId);
    if (!assigner || assigner.classId !== run.classId) return null;
    const classDoc = await ctx.db.get("classes", run.classId);
    if (!classDoc) return null;
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
      assignments: run.assignments,
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
