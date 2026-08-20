import { ConvexError, v } from "convex/values";

import { APP_CONFIG } from "./appConfig.js";
import { components } from "./_generated/api.js";
import type { Doc, Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { assignEquitable, type EquitableAssignRecipient } from "./lib/assigners/equitableAssign.js";
import {
  buildEquitableManualSlots,
  validateEquitableManualAssignments,
  type EquitableManualSlotAssignmentInput,
} from "./lib/assigners/equitableManualSlots.js";
import {
  buildEquitablePartnerSummaries,
  buildEquitableRosterMatrixCounts,
} from "./lib/assigners/equitableRosterMatrix.js";
import {
  equitableAssignerFormSchemaEn,
  normalizeStoredGenderBuckets,
  type EquitableAssignerFormValues,
} from "./lib/assigners/equitableAssignerSchema.js";
import {
  type EquitableGenderBucket,
  normalizeEquitableGenderBuckets,
} from "./lib/assigners/equitableGenderBuckets.js";
import {
  assignerRunAssignmentValidator,
  projectAssignerRunAssignments,
} from "./lib/assigners/runAssignmentProjection.js";
import { genderBucketFromRoster } from "./lib/seating/gender.js";
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
const genderBucketValidator = v.union(
  v.literal("m"),
  v.literal("f"),
  v.literal("other"),
  v.literal("unknown"),
);
const genderBucketsValidator = v.array(genderBucketValidator);

const manualSlotValidator = v.object({
  id: v.string(),
  item: v.string(),
  scope: scopeValidator,
  groupId: v.optional(v.id("groups")),
  groupName: v.optional(v.string()),
  genderRequired: v.optional(genderBucketValidator),
});

const manualStudentValidator = v.object({
  userId: v.id("users"),
  displayName: v.string(),
  rosterNumber: v.optional(v.number()),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  image: v.optional(v.string()),
  email: v.optional(v.string()),
  genderBucket: genderBucketValidator,
  groupId: v.optional(v.id("groups")),
  groupName: v.optional(v.string()),
});

const manualGroupValidator = v.object({
  groupId: v.id("groups"),
  groupName: v.string(),
});

const manualSlotAssignmentInputValidator = v.object({
  slotId: v.string(),
  studentUserId: v.id("users"),
});

const equitableStudentStatValidator = v.object({
  label: v.string(),
  count: v.number(),
  percent: v.number(),
});

const equitableStudentSummaryValidator = v.object({
  studentUserId: v.id("users"),
  totalRecorded: v.number(),
  draftItem: v.optional(v.string()),
  draftGroupName: v.optional(v.string()),
  currentItem: v.optional(equitableStudentStatValidator),
  currentGroup: v.optional(equitableStudentStatValidator),
  itemBreakdown: v.array(equitableStudentStatValidator),
});

const equitableHistoryItemValidator = v.object({
  runId: v.id("equitableAssignerRuns"),
  ranAt: v.number(),
  item: v.string(),
  groupName: v.optional(v.string()),
});

const equitableRosterMatrixStudentValidator = v.object({
  userId: v.id("users"),
  rosterNumber: v.number(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  email: v.optional(v.string()),
});

const equitableRosterMatrixCountValidator = v.object({
  item: v.string(),
  count: v.number(),
});

const equitableRosterMatrixRowValidator = v.object({
  studentUserId: v.id("users"),
  counts: v.array(equitableRosterMatrixCountValidator),
});

const equitablePartnerSummaryValidator = v.object({
  partnerUserId: v.id("users"),
  count: v.number(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  name: v.optional(v.string()),
});

const equitableStudentPartnersValidator = v.object({
  studentUserId: v.id("users"),
  partners: v.array(equitablePartnerSummaryValidator),
});

const equitableRosterMatrixValidator = v.object({
  items: v.array(v.string()),
  students: v.array(equitableRosterMatrixStudentValidator),
  countsByStudent: v.array(equitableRosterMatrixRowValidator),
  partnersByStudent: v.array(equitableStudentPartnersValidator),
});

const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 50;

const priorAssignmentValidator = v.object({
  studentUserId: v.id("users"),
  item: v.string(),
  groupId: v.optional(v.id("groups")),
  groupName: v.optional(v.string()),
  runKey: v.optional(v.string()),
});

const equitableAssignerListItemValidator = v.object({
  _id: v.id("equitableAssigners"),
  _creationTime: v.number(),
  name: v.string(),
  items: v.array(v.string()),
  defaultBalanceGender: v.boolean(),
  defaultScope: scopeValidator,
  defaultGenderBuckets: genderBucketsValidator,
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
  runCount: v.number(),
  latestRunId: v.union(v.id("equitableAssignerRuns"), v.null()),
  latestRunAt: v.union(v.number(), v.null()),
});

const equitableAssignerDetailValidator = v.object({
  _id: v.id("equitableAssigners"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  name: v.string(),
  items: v.array(v.string()),
  defaultBalanceGender: v.boolean(),
  defaultScope: scopeValidator,
  defaultGenderBuckets: genderBucketsValidator,
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const manualSetupValidator = v.object({
  assigner: equitableAssignerDetailValidator,
  students: v.array(manualStudentValidator),
  groups: v.array(manualGroupValidator),
  slots: v.array(manualSlotValidator),
  priorAssignments: v.array(priorAssignmentValidator),
});

const equitableAssignerRunListItemValidator = v.object({
  _id: v.id("equitableAssignerRuns"),
  _creationTime: v.number(),
  assignerId: v.id("equitableAssigners"),
  ranAt: v.number(),
  ranBy: v.id("users"),
  scope: scopeValidator,
  balanceGender: v.boolean(),
  genderBuckets: genderBucketsValidator,
  assignmentCount: v.number(),
});

const equitableAssignerRunDetailValidator = v.object({
  _id: v.id("equitableAssignerRuns"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  assignerId: v.id("equitableAssigners"),
  assignerName: v.string(),
  ranAt: v.number(),
  ranBy: v.id("users"),
  scope: scopeValidator,
  balanceGender: v.boolean(),
  genderBuckets: genderBucketsValidator,
  itemsSnapshot: v.array(v.string()),
  assignments: v.array(assignerRunAssignmentValidator),
});

const equitableAssignerDisplayRunValidator = v.object({
  _id: v.id("equitableAssignerRuns"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  assignerId: v.id("equitableAssigners"),
  assignerName: v.string(),
  ranAt: v.number(),
  ranBy: v.id("users"),
  scope: scopeValidator,
  balanceGender: v.boolean(),
  genderBuckets: genderBucketsValidator,
  itemsSnapshot: v.array(v.string()),
  assignments: v.array(assignerRunAssignmentValidator),
  nameFormat: v.object({
    order: v.union(v.literal("firstLast"), v.literal("lastFirst")),
    space: v.boolean(),
  }),
});

function parseFormInput(input: {
  name: string;
  items: string[];
  defaultBalanceGender: boolean;
  defaultScope: "class" | "groups";
  defaultGenderBuckets: EquitableGenderBucket[];
}): EquitableAssignerFormValues {
  const parsed = equitableAssignerFormSchemaEn.safeParse(input);
  if (!parsed.success) {
    throw new ConvexError({
      code: "INVALID_INPUT",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    });
  }
  return parsed.data;
}

function assignerDetailFromDoc(assigner: Doc<"equitableAssigners">) {
  return {
    _id: assigner._id,
    _creationTime: assigner._creationTime,
    classId: assigner.classId,
    name: assigner.name,
    items: assigner.items,
    defaultBalanceGender: assigner.defaultBalanceGender,
    defaultScope: assigner.defaultScope,
    defaultGenderBuckets: normalizeStoredGenderBuckets(assigner.defaultGenderBuckets),
    createdBy: assigner.createdBy,
    createdAt: assigner.createdAt,
    updatedAt: assigner.updatedAt,
  };
}

function resolveRunGenderBuckets(
  assigner: Doc<"equitableAssigners">,
  requested?: ReadonlyArray<EquitableGenderBucket>,
): EquitableGenderBucket[] {
  if (requested && requested.length > 0) {
    return normalizeEquitableGenderBuckets(requested);
  }
  return normalizeStoredGenderBuckets(assigner.defaultGenderBuckets);
}

async function requireEquitableAssigner(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners">,
): Promise<Doc<"equitableAssigners">> {
  const assigner = await ctx.db.get("equitableAssigners", assignerId);
  if (!assigner || assigner.classId !== classId) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Equitable assigner not found",
    });
  }
  return assigner;
}

async function requireEquitableAssignerRun(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners">,
  runId: Id<"equitableAssignerRuns">,
): Promise<Doc<"equitableAssignerRuns">> {
  const run = await ctx.db.get("equitableAssignerRuns", runId);
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
    EquitableAssignRecipient & {
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
            gender: row.gender,
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
    EquitableAssignRecipient & {
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
    const genderBucket = genderBucketFromRoster(roster?.gender);

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
        genderBucket,
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
        genderBucket,
      });
    }
  }

  return recipients;
}

async function loadPriorAssignments(
  ctx: MutationCtx | QueryCtx,
  assignerId: Id<"equitableAssigners">,
): Promise<
  Array<{
    studentUserId: string;
    item: string;
    groupId?: string;
    groupName?: string;
    runKey: string;
  }>
> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded history
  const runs = await ctx.db
    .query("equitableAssignerRuns")
    .withIndex("by_assignerId_ranAt", (q) => q.eq("assignerId", assignerId))
    .order("asc")
    .collect();
  const prior: Array<{
    studentUserId: string;
    item: string;
    groupId?: string;
    groupName?: string;
    runKey: string;
  }> = [];
  for (const run of runs) {
    for (const assignment of run.assignments) {
      prior.push({
        studentUserId: assignment.studentUserId,
        item: assignment.item,
        groupId: assignment.groupId,
        groupName: assignment.groupName,
        runKey: run._id,
      });
    }
  }
  return prior;
}

function percent(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

async function loadGroupsForClass(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
): Promise<Array<{ groupId: Id<"groups">; groupName: string }>> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded groups
  const groupDocs = await ctx.db
    .query("groups")
    .withIndex("by_class", (q) => q.eq("classId", classId))
    .collect();
  return groupDocs
    .map((group) => ({ groupId: group._id, groupName: group.name }))
    .sort((a, b) => a.groupName.localeCompare(b.groupName));
}

type ManualStudentRow = {
  userId: Id<"users">;
  displayName: string;
  rosterNumber?: number;
  firstName?: string;
  lastName?: string;
  image?: string;
  email?: string;
  genderBucket: "m" | "f" | "other" | "unknown";
  groupId?: Id<"groups">;
  groupName?: string;
};

async function loadManualStudents(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
  scope: "class" | "groups",
): Promise<ManualStudentRow[]> {
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

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded memberships
  const membershipDocs = await ctx.db
    .query("groupMemberships")
    .withIndex("by_class", (q) => q.eq("classId", classId))
    .collect();
  const membershipByStudent = new Map(
    membershipDocs.map((row) => [row.studentUserId, row] as const),
  );

  const groupNameById = new Map<string, string>();
  for (const group of await loadGroupsForClass(ctx, classId)) {
    groupNameById.set(group.groupId, group.groupName);
  }

  const students: ManualStudentRow[] = [];
  for (const userId of studentIds) {
    const user = await ctx.db.get("users", userId);
    const roster = rosterByUserId.get(userId);
    const membership = membershipByStudent.get(userId);
    const genderBucket = genderBucketFromRoster(roster?.gender);

    if (scope === "groups" && !membership) continue;

    students.push({
      userId,
      displayName: studentDisplayName(user, roster, nameFormat, userId),
      rosterNumber: roster?.rosterNumber,
      firstName: roster?.firstName,
      lastName: roster?.lastName,
      image: user?.image,
      email: user?.email,
      genderBucket,
      groupId: membership?.groupId,
      groupName: membership ? groupNameById.get(membership.groupId) : undefined,
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

async function loadStudentPriorAssignments(
  ctx: QueryCtx | MutationCtx,
  assignerId: Id<"equitableAssigners">,
  studentUserId: Id<"users">,
): Promise<
  Array<{
    item: string;
    groupId?: Id<"groups">;
    groupName?: string;
    ranAt: number;
    runId: Id<"equitableAssignerRuns">;
  }>
> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded history
  const runs = await ctx.db
    .query("equitableAssignerRuns")
    .withIndex("by_assignerId_ranAt", (q) => q.eq("assignerId", assignerId))
    .order("desc")
    .collect();

  const prior: Array<{
    item: string;
    groupId?: Id<"groups">;
    groupName?: string;
    ranAt: number;
    runId: Id<"equitableAssignerRuns">;
  }> = [];

  for (const run of runs) {
    for (const assignment of run.assignments) {
      if (assignment.studentUserId !== studentUserId) continue;
      prior.push({
        item: assignment.item,
        groupId: assignment.groupId,
        groupName: assignment.groupName,
        ranAt: run.ranAt,
        runId: run._id,
      });
    }
  }

  return prior;
}

function buildAssignmentsFromManualInput(args: {
  slots: ReturnType<typeof buildEquitableManualSlots>;
  assignments: EquitableManualSlotAssignmentInput[];
  students: ManualStudentRow[];
}): Array<{
  studentUserId: Id<"users">;
  studentDisplayName: string;
  item: string;
  rosterNumber?: number;
  firstName?: string;
  lastName?: string;
  groupId?: Id<"groups">;
  groupName?: string;
}> {
  const slotById = new Map(args.slots.map((slot) => [slot.id, slot]));
  const studentById = new Map(args.students.map((student) => [student.userId, student]));

  return args.assignments.map((assignment) => {
    const slot = slotById.get(assignment.slotId);
    const student = studentById.get(assignment.studentUserId);
    if (!slot || !student) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Invalid manual assignment" });
    }
    return {
      studentUserId: assignment.studentUserId,
      studentDisplayName: student.displayName,
      item: slot.item,
      rosterNumber: student.rosterNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      groupId: slot.groupId,
      groupName: slot.groupName,
    };
  });
}

async function latestRunForAssigner(
  ctx: QueryCtx | MutationCtx,
  assignerId: Id<"equitableAssigners">,
): Promise<Doc<"equitableAssignerRuns"> | null> {
  const run = await ctx.db
    .query("equitableAssignerRuns")
    .withIndex("by_assignerId_ranAt", (q) => q.eq("assignerId", assignerId))
    .order("desc")
    .first();
  return run ?? null;
}

export const listForClass = classQuery({
  args: {},
  returns: v.array(equitableAssignerListItemValidator),
  handler: async (ctx) => {
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
    const rows = await ctx.db
      .query("equitableAssigners")
      .withIndex("by_classId", (q) => q.eq("classId", ctx.classDoc._id))
      .collect();
    rows.sort((a, b) => a.name.localeCompare(b.name));

    const result = [];
    for (const row of rows) {
      // eslint-disable-next-line @convex-dev/no-collect-in-query -- per-assigner run count, classroom-bounded
      const runs = await ctx.db
        .query("equitableAssignerRuns")
        .withIndex("by_assignerId", (q) => q.eq("assignerId", row._id))
        .collect();
      const latest = await latestRunForAssigner(ctx, row._id);
      result.push({
        _id: row._id,
        _creationTime: row._creationTime,
        name: row.name,
        items: row.items,
        defaultBalanceGender: row.defaultBalanceGender,
        defaultScope: row.defaultScope,
        defaultGenderBuckets: normalizeStoredGenderBuckets(row.defaultGenderBuckets),
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
  args: { assignerId: v.id("equitableAssigners") },
  returns: equitableAssignerDetailValidator,
  handler: async (ctx, args) => {
    const assigner = await requireEquitableAssigner(ctx, ctx.classDoc._id, args.assignerId);
    return assignerDetailFromDoc(assigner);
  },
});

export const listRuns = classQuery({
  args: { assignerId: v.id("equitableAssigners") },
  returns: v.array(equitableAssignerRunListItemValidator),
  handler: async (ctx, args) => {
    await requireEquitableAssigner(ctx, ctx.classDoc._id, args.assignerId);
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded history
    const runs = await ctx.db
      .query("equitableAssignerRuns")
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
      balanceGender: run.balanceGender,
      genderBuckets: normalizeStoredGenderBuckets(run.genderBuckets),
      assignmentCount: run.assignments.length,
    }));
  },
});

export const getRun = classQuery({
  args: {
    assignerId: v.id("equitableAssigners"),
    runId: v.id("equitableAssignerRuns"),
  },
  returns: equitableAssignerRunDetailValidator,
  handler: async (ctx, args) => {
    const assigner = await requireEquitableAssigner(ctx, ctx.classDoc._id, args.assignerId);
    const run = await requireEquitableAssignerRun(
      ctx,
      ctx.classDoc._id,
      args.assignerId,
      args.runId,
    );
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
      balanceGender: run.balanceGender,
      genderBuckets: normalizeStoredGenderBuckets(run.genderBuckets),
      itemsSnapshot: run.itemsSnapshot,
      assignments: projectAssignerRunAssignments(run.assignments, canReadStudents),
    };
  },
});

/** Display route lookup by run id without class layout context. */
export const getRunById = authedQuery({
  args: { runId: v.id("equitableAssignerRuns") },
  returns: v.union(equitableAssignerDisplayRunValidator, v.null()),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("equitableAssignerRuns", args.runId);
    if (!run) return null;
    const canRead = await authz.can(ctx, ctx.userId, "class:read", classScope(run.classId));
    if (!canRead) return null;
    const assigner = await ctx.db.get("equitableAssigners", run.assignerId);
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
      balanceGender: run.balanceGender,
      genderBuckets: normalizeStoredGenderBuckets(run.genderBuckets),
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
    defaultBalanceGender: v.boolean(),
    defaultScope: scopeValidator,
    defaultGenderBuckets: genderBucketsValidator,
  },
  returns: v.id("equitableAssigners"),
  handler: async (ctx, args) => {
    await ctx.require("assigners:manage");
    const parsed = parseFormInput(args);
    const now = Date.now();
    const assignerId = await ctx.db.insert("equitableAssigners", {
      classId: ctx.classDoc._id,
      name: parsed.name,
      items: parsed.items,
      defaultBalanceGender: parsed.defaultBalanceGender,
      defaultScope: parsed.defaultScope,
      defaultGenderBuckets: parsed.defaultGenderBuckets,
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "equitableAssigner",
      resourceId: assignerId,
      summary: `Created equitable assigner "${parsed.name}"`,
      summaryKey: "activitySummary_createdEquitableAssigner",
      metadata: { name: parsed.name },
    });

    return assignerId;
  },
});

export const update = classMutation({
  args: {
    assignerId: v.id("equitableAssigners"),
    name: v.string(),
    items: v.array(v.string()),
    defaultBalanceGender: v.boolean(),
    defaultScope: scopeValidator,
    defaultGenderBuckets: genderBucketsValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("assigners:manage");
    const existing = await requireEquitableAssigner(ctx, ctx.classDoc._id, args.assignerId);
    const parsed = parseFormInput(args);
    await ctx.db.patch("equitableAssigners", existing._id, {
      name: parsed.name,
      items: parsed.items,
      defaultBalanceGender: parsed.defaultBalanceGender,
      defaultScope: parsed.defaultScope,
      defaultGenderBuckets: parsed.defaultGenderBuckets,
      updatedAt: Date.now(),
    });

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "equitableAssigner",
      resourceId: existing._id,
      summary: `Updated equitable assigner "${parsed.name}"`,
      summaryKey: "activitySummary_updatedEquitableAssigner",
      metadata: { name: parsed.name },
    });

    return null;
  },
});

export const remove = classMutation({
  args: { assignerId: v.id("equitableAssigners") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("assigners:manage");
    const existing = await requireEquitableAssigner(ctx, ctx.classDoc._id, args.assignerId);
    const name = existing.name;

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded cleanup
    const runs = await ctx.db
      .query("equitableAssignerRuns")
      .withIndex("by_assignerId", (q) => q.eq("assignerId", existing._id))
      .collect();
    for (const run of runs) {
      await ctx.db.delete("equitableAssignerRuns", run._id);
    }
    await ctx.db.delete("equitableAssigners", existing._id);

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "equitableAssigner",
      resourceId: args.assignerId,
      summary: `Deleted equitable assigner "${name}"`,
      summaryKey: "activitySummary_deletedEquitableAssigner",
      metadata: { name },
    });

    return null;
  },
});

export const run = classMutation({
  args: {
    assignerId: v.id("equitableAssigners"),
    scope: scopeValidator,
    balanceGender: v.boolean(),
    genderBuckets: v.optional(genderBucketsValidator),
  },
  returns: v.id("equitableAssignerRuns"),
  handler: async (ctx, args) => {
    await ctx.require("assigners:manage");
    const assigner = await requireEquitableAssigner(ctx, ctx.classDoc._id, args.assignerId);
    if (assigner.items.length === 0) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "Add at least one item before running",
      });
    }

    const genderBuckets = resolveRunGenderBuckets(assigner, args.genderBuckets);
    const recipients = await loadRecipientsForRun(ctx, ctx.classDoc._id, args.scope);
    if (recipients.length === 0) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message:
          args.scope === "groups" ? "No grouped students to assign" : "No students to assign",
      });
    }

    const priorAssignments = await loadPriorAssignments(ctx, assigner._id);

    const rawAssignments = assignEquitable({
      items: assigner.items,
      recipients,
      scope: args.scope,
      balanceGender: args.balanceGender,
      genderBuckets,
      priorAssignments,
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
    const runId = await ctx.db.insert("equitableAssignerRuns", {
      classId: ctx.classDoc._id,
      assignerId: assigner._id,
      ranAt: now,
      ranBy: ctx.userId,
      scope: args.scope,
      balanceGender: args.balanceGender,
      genderBuckets,
      itemsSnapshot: [...assigner.items],
      assignments,
    });

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "equitableAssigner",
      resourceId: runId,
      summary: `Ran equitable assigner "${assigner.name}"`,
      summaryKey: "activitySummary_ranEquitableAssigner",
      metadata: { name: assigner.name },
    });

    return runId;
  },
});

export const removeRun = classMutation({
  args: {
    assignerId: v.id("equitableAssigners"),
    runId: v.id("equitableAssignerRuns"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.require("assigners:manage");
    const assigner = await requireEquitableAssigner(ctx, ctx.classDoc._id, args.assignerId);
    await requireEquitableAssignerRun(ctx, ctx.classDoc._id, args.assignerId, args.runId);
    await ctx.db.delete("equitableAssignerRuns", args.runId);

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "equitableAssigner",
      resourceId: args.runId,
      summary: `Deleted assignment run for "${assigner.name}"`,
      summaryKey: "activitySummary_deletedEquitableAssignerRun",
      metadata: { name: assigner.name },
    });

    return null;
  },
});

export const manualSetup = classQuery({
  args: {
    assignerId: v.id("equitableAssigners"),
    scope: scopeValidator,
    balanceGender: v.boolean(),
    genderBuckets: v.optional(genderBucketsValidator),
  },
  returns: manualSetupValidator,
  handler: async (ctx, args) => {
    await ctx.require("assigners:manage");
    const assigner = await requireEquitableAssigner(ctx, ctx.classDoc._id, args.assignerId);
    const genderBuckets = resolveRunGenderBuckets(assigner, args.genderBuckets);
    const groups = await loadGroupsForClass(ctx, ctx.classDoc._id);
    const students = await loadManualStudents(ctx, ctx.classDoc._id, args.scope);
    const manualRecipients = students.map((student) => ({
      genderBucket: student.genderBucket,
      groupId: student.groupId,
    }));
    const slots = buildEquitableManualSlots({
      items: assigner.items,
      scope: args.scope,
      balanceGender: args.balanceGender,
      genderBuckets,
      groups,
      recipients: manualRecipients,
    });
    const priorRows = await loadPriorAssignments(ctx, assigner._id);

    return {
      assigner: assignerDetailFromDoc(assigner),
      students,
      groups,
      slots,
      priorAssignments: priorRows.map((row) => ({
        studentUserId: row.studentUserId as Id<"users">,
        item: row.item,
        ...(row.groupId ? { groupId: row.groupId as Id<"groups"> } : {}),
        ...(row.groupName ? { groupName: row.groupName } : {}),
        runKey: row.runKey,
      })),
    };
  },
});

export const createManualRun = classMutation({
  args: {
    assignerId: v.id("equitableAssigners"),
    scope: scopeValidator,
    balanceGender: v.boolean(),
    genderBuckets: v.optional(genderBucketsValidator),
    assignments: v.array(manualSlotAssignmentInputValidator),
  },
  returns: v.id("equitableAssignerRuns"),
  handler: async (ctx, args) => {
    await ctx.require("assigners:manage");
    const assigner = await requireEquitableAssigner(ctx, ctx.classDoc._id, args.assignerId);
    if (assigner.items.length === 0) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: "Add at least one item before saving",
      });
    }

    const genderBuckets = resolveRunGenderBuckets(assigner, args.genderBuckets);
    const groups = await loadGroupsForClass(ctx, ctx.classDoc._id);
    const students = await loadManualStudents(ctx, ctx.classDoc._id, args.scope);
    if (students.length === 0) {
      throw new ConvexError({
        code: "INVALID_INPUT",
        message:
          args.scope === "groups" ? "No grouped students to assign" : "No students to assign",
      });
    }

    const manualRecipients = students.map((student) => ({
      genderBucket: student.genderBucket,
      groupId: student.groupId,
    }));
    const slots = buildEquitableManualSlots({
      items: assigner.items,
      scope: args.scope,
      balanceGender: args.balanceGender,
      genderBuckets,
      groups,
      recipients: manualRecipients,
    });

    const validation = validateEquitableManualAssignments({
      slots,
      assignments: args.assignments,
      recipients: students.map((student) => ({
        studentUserId: student.userId,
        genderBucket: student.genderBucket,
        groupId: student.groupId,
      })),
      scope: args.scope,
      balanceGender: args.balanceGender,
    });

    if (!validation.ok) {
      const messages: Record<typeof validation.code, string> = {
        INVALID_SLOT: "One or more slots are invalid",
        DUPLICATE_STUDENT: "Each student can only be assigned once",
        MISSING_SLOT: "Fill every required slot before saving",
        INELIGIBLE_STUDENT: "One or more students are not eligible",
        GENDER_MISMATCH: "A student does not match the slot gender requirement",
        GROUP_MISMATCH: "A student does not belong to the slot group",
      };
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: messages[validation.code],
      });
    }

    const assignments = buildAssignmentsFromManualInput({
      slots,
      assignments: args.assignments,
      students,
    });

    const now = Date.now();
    const runId = await ctx.db.insert("equitableAssignerRuns", {
      classId: ctx.classDoc._id,
      assignerId: assigner._id,
      ranAt: now,
      ranBy: ctx.userId,
      scope: args.scope,
      balanceGender: args.balanceGender,
      genderBuckets,
      itemsSnapshot: [...assigner.items],
      assignments,
    });

    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "equitableAssigner",
      resourceId: runId,
      summary: `Created manual equitable assignment for "${assigner.name}"`,
      summaryKey: "activitySummary_createdEquitableManualRun",
      metadata: { name: assigner.name },
    });

    return runId;
  },
});

export const studentSummary = classQuery({
  args: {
    assignerId: v.id("equitableAssigners"),
    studentUserId: v.id("users"),
    draftSlotId: v.optional(v.string()),
    scope: scopeValidator,
    balanceGender: v.boolean(),
    genderBuckets: v.optional(genderBucketsValidator),
  },
  returns: equitableStudentSummaryValidator,
  handler: async (ctx, args) => {
    await ctx.require("assigners:manage");
    const assigner = await requireEquitableAssigner(ctx, ctx.classDoc._id, args.assignerId);
    const genderBuckets = resolveRunGenderBuckets(assigner, args.genderBuckets);
    const groups = await loadGroupsForClass(ctx, ctx.classDoc._id);
    const students = await loadManualStudents(ctx, ctx.classDoc._id, args.scope);
    const slots = buildEquitableManualSlots({
      items: assigner.items,
      scope: args.scope,
      balanceGender: args.balanceGender,
      genderBuckets,
      groups,
      recipients: students.map((student) => ({
        genderBucket: student.genderBucket,
        groupId: student.groupId,
      })),
    });
    const slotById = new Map(slots.map((slot) => [slot.id, slot]));

    const prior = await loadStudentPriorAssignments(ctx, assigner._id, args.studentUserId);
    const totalRecorded = prior.length;

    const itemCounts = new Map<string, number>();
    for (const row of prior) {
      itemCounts.set(row.item, (itemCounts.get(row.item) ?? 0) + 1);
    }

    const itemBreakdown = assigner.items.map((item) => ({
      label: item,
      count: itemCounts.get(item) ?? 0,
      percent: percent(itemCounts.get(item) ?? 0, totalRecorded),
    }));

    let draftItem: string | undefined;
    let draftGroupName: string | undefined;
    let currentItem: { label: string; count: number; percent: number } | undefined;
    let currentGroup: { label: string; count: number; percent: number } | undefined;

    if (args.draftSlotId) {
      const draftSlot = slotById.get(args.draftSlotId);
      if (draftSlot) {
        draftItem = draftSlot.item;
        draftGroupName = draftSlot.groupName;
        const itemCount = prior.filter((row) => row.item === draftSlot.item).length;
        currentItem = {
          label: draftSlot.item,
          count: itemCount,
          percent: percent(itemCount, totalRecorded),
        };
        if (draftSlot.groupName) {
          const groupCount = prior.filter((row) => row.groupName === draftSlot.groupName).length;
          currentGroup = {
            label: draftSlot.groupName,
            count: groupCount,
            percent: percent(groupCount, totalRecorded),
          };
        }
      }
    }

    return {
      studentUserId: args.studentUserId,
      totalRecorded,
      ...(draftItem !== undefined ? { draftItem } : {}),
      ...(draftGroupName !== undefined ? { draftGroupName } : {}),
      ...(currentItem !== undefined ? { currentItem } : {}),
      ...(currentGroup !== undefined ? { currentGroup } : {}),
      itemBreakdown,
    };
  },
});

export const studentHistory = classQuery({
  args: {
    assignerId: v.id("equitableAssigners"),
    studentUserId: v.id("users"),
    item: v.string(),
    groupName: v.optional(v.string()),
    beforeRanAt: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    items: v.array(equitableHistoryItemValidator),
    nextBeforeRanAt: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    await ctx.require("assigners:manage");
    await requireEquitableAssigner(ctx, ctx.classDoc._id, args.assignerId);

    const limit = Math.min(
      Math.max(1, Math.floor(args.limit ?? DEFAULT_HISTORY_LIMIT)),
      MAX_HISTORY_LIMIT,
    );

    const prior = await loadStudentPriorAssignments(ctx, args.assignerId, args.studentUserId);
    const filtered = prior.filter((row) => {
      if (row.item !== args.item) return false;
      if (args.groupName !== undefined && row.groupName !== args.groupName) return false;
      if (args.beforeRanAt !== undefined && row.ranAt >= args.beforeRanAt) return false;
      return true;
    });

    const items = filtered.slice(0, limit).map((row) => ({
      runId: row.runId,
      ranAt: row.ranAt,
      item: row.item,
      ...(row.groupName !== undefined ? { groupName: row.groupName } : {}),
    }));

    const last = filtered.at(limit - 1);
    return {
      items,
      ...(filtered.length > limit && last ? { nextBeforeRanAt: last.ranAt } : {}),
    };
  },
});

export const partnerHistory = classQuery({
  args: {
    assignerId: v.id("equitableAssigners"),
    studentUserId: v.id("users"),
    partnerUserId: v.id("users"),
    beforeRanAt: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    items: v.array(equitableHistoryItemValidator),
    nextBeforeRanAt: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    await ctx.require("assigners:manage");
    await requireEquitableAssigner(ctx, ctx.classDoc._id, args.assignerId);

    const limit = Math.min(
      Math.max(1, Math.floor(args.limit ?? DEFAULT_HISTORY_LIMIT)),
      MAX_HISTORY_LIMIT,
    );

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded history
    const runs = await ctx.db
      .query("equitableAssignerRuns")
      .withIndex("by_assignerId_ranAt", (q) => q.eq("assignerId", args.assignerId))
      .order("desc")
      .collect();

    const shared: Array<{
      runId: Id<"equitableAssignerRuns">;
      ranAt: number;
      item: string;
      groupName?: string;
    }> = [];

    for (const run of runs) {
      const studentRows = run.assignments.filter(
        (assignment) => assignment.studentUserId === args.studentUserId,
      );
      const partnerRows = run.assignments.filter(
        (assignment) => assignment.studentUserId === args.partnerUserId,
      );
      if (studentRows.length === 0 || partnerRows.length === 0) continue;

      for (const studentRow of studentRows) {
        for (const partnerRow of partnerRows) {
          if (studentRow.item !== partnerRow.item) continue;
          if ((studentRow.groupId ?? "") !== (partnerRow.groupId ?? "")) continue;
          if (args.beforeRanAt !== undefined && run.ranAt >= args.beforeRanAt) continue;
          shared.push({
            runId: run._id,
            ranAt: run.ranAt,
            item: studentRow.item,
            ...(studentRow.groupName !== undefined ? { groupName: studentRow.groupName } : {}),
          });
        }
      }
    }

    const items = shared.slice(0, limit).map((row) => ({
      runId: row.runId,
      ranAt: row.ranAt,
      item: row.item,
      ...(row.groupName !== undefined ? { groupName: row.groupName } : {}),
    }));
    const last = shared.at(limit - 1);
    return {
      items,
      ...(shared.length > limit && last ? { nextBeforeRanAt: last.ranAt } : {}),
    };
  },
});

export const rosterMatrix = classQuery({
  args: {
    assignerId: v.id("equitableAssigners"),
  },
  returns: equitableRosterMatrixValidator,
  handler: async (ctx, args) => {
    await ctx.require("assigners:manage");
    const assigner = await requireEquitableAssigner(ctx, ctx.classDoc._id, args.assignerId);
    const students = await loadManualStudents(ctx, ctx.classDoc._id, "class");
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded history
    const runs = await ctx.db
      .query("equitableAssignerRuns")
      .withIndex("by_assignerId_ranAt", (q) => q.eq("assignerId", assigner._id))
      .order("asc")
      .collect();
    const priorRows = runs.flatMap((run) =>
      run.assignments.map((assignment) => ({
        studentUserId: assignment.studentUserId,
        item: assignment.item,
      })),
    );
    const studentUserIds = students.map((student) => student.userId);
    const countsByStudent = buildEquitableRosterMatrixCounts(
      assigner.items,
      studentUserIds,
      priorRows,
    );
    const partnersByStudent = buildEquitablePartnerSummaries(
      studentUserIds,
      runs.map((run) => ({
        assignments: run.assignments.map((assignment) => ({
          studentUserId: assignment.studentUserId,
          item: assignment.item,
          groupId: assignment.groupId,
          firstName: assignment.firstName,
          lastName: assignment.lastName,
          studentDisplayName: assignment.studentDisplayName,
        })),
      })),
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
      partnersByStudent,
    };
  },
});
