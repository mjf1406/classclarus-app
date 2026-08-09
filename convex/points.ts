import { ConvexError, v } from "convex/values";

import { APP_CONFIG } from "./appConfig.js";
import { components } from "./_generated/api.js";
import type { Doc, Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { classScope } from "./lib/authzModel.js";
import { recordClassActivity } from "./lib/classActivity.js";
import { classMutation, classQuery } from "./lib/customFunctions.js";
import {
  assertPersonalStudentAccess,
  getClassRoleForUser,
  resolvePersonalStudentIds,
} from "./lib/guardianLinks.js";
import {
  aggregateMinusCountsByStudent,
  aggregateWarningCountsByStudent,
  pointsBadgeLookbackWindow,
  resolvePointsBadgeWindow,
} from "./lib/pointsBadgeWindow.js";
import {
  applyBehaviorPointsDelta,
  applyRewardPointsDelta,
  ensureRosterPointCounters,
  ledgerQuantity,
  readRosterPointCounters,
  requireRosterRow,
} from "./lib/pointsRoster.js";
import {
  effectivePurchaseLimitForReward,
  isTimestampInPurchaseLimitWindow,
  purchaseLimitPoolKey,
  purchaseLimitWindow,
  rewardPurchaseLimitStatusValidator,
} from "./lib/purchaseLimit.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import { resolveUserImageUrl } from "./lib/userImage.js";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_QUANTITY = 999;
const MAX_STUDENTS_PER_APPLY = 200;
const MAX_ITEMS_PER_APPLY = 50;
const DEFAULT_LEDGER_LIMIT = 40;
const MAX_LEDGER_LIMIT = 100;

const genderValidator = v.union(
  v.literal("male"),
  v.literal("female"),
  v.literal("transMale"),
  v.literal("transFemale"),
  v.literal("nonBinary"),
  v.literal("selfDescribe"),
  v.literal("preferNotToSay"),
);

const pronounsValidator = v.union(
  v.literal("heHim"),
  v.literal("sheHer"),
  v.literal("theyThem"),
  v.literal("heThey"),
  v.literal("sheThey"),
  v.literal("useNameOnly"),
  v.literal("askSelfDescribe"),
  v.literal("preferNotToSay"),
);

const attendanceStatusValidator = v.union(
  v.literal("present"),
  v.literal("absent"),
  v.literal("late"),
);

const boardStudentValidator = v.object({
  userId: v.id("users"),
  rosterNumber: v.number(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  email: v.optional(v.string()),
  gender: v.optional(genderValidator),
  genderSelfDescribe: v.optional(v.string()),
  pronouns: v.optional(pronounsValidator),
  pronounsSelfDescribe: v.optional(v.string()),
  pointsBalance: v.number(),
  pointsAwarded: v.number(),
  pointsRemoved: v.number(),
  pointsRedeemed: v.number(),
  warningCount: v.number(),
  minusCount: v.number(),
  attendanceStatus: v.optional(attendanceStatusValidator),
});

function assertValidDateKey(dateKey: string): void {
  if (!DATE_KEY_RE.test(dateKey)) {
    throw new Error("Invalid date key");
  }
}

function normalizeQuantity(quantity: number): number {
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Quantity must be a whole number of at least 1");
  }
  if (quantity > MAX_QUANTITY) {
    throw new Error(`Quantity must be at most ${MAX_QUANTITY}`);
  }
  return quantity;
}

async function listStudentUserIds(
  ctx: QueryCtx | MutationCtx,
  classId: Id<"classes">,
): Promise<Array<Id<"users">>> {
  const scope = classScope(classId);
  const users = await ctx.runQuery(components.authz.queries.getUsersWithRole, {
    tenantId: APP_CONFIG.authzTenantId,
    role: "student",
    scope,
  });
  return users.map((entry: { userId: string }) => entry.userId as Id<"users">);
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

async function requireStudentsInClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
  studentUserIds: ReadonlyArray<Id<"users">>,
): Promise<void> {
  if (studentUserIds.length === 0) {
    throw new Error("Select at least one student");
  }
  if (studentUserIds.length > MAX_STUDENTS_PER_APPLY) {
    throw new Error(`Too many students (max ${MAX_STUDENTS_PER_APPLY})`);
  }
  const unique = new Set(studentUserIds);
  if (unique.size !== studentUserIds.length) {
    throw new Error("Duplicate students in selection");
  }
  for (const studentUserId of studentUserIds) {
    await requireStudentInClass(ctx, classId, studentUserId);
  }
}

async function loadBadgeCountsForClass(
  ctx: QueryCtx,
  classDoc: Doc<"classes">,
  dateKey: string,
  timeZoneOffsetMinutes: number,
): Promise<{
  warningByStudent: Map<Id<"users">, number>;
  minusByStudent: Map<Id<"users">, number>;
}> {
  if (!Number.isFinite(timeZoneOffsetMinutes)) {
    throw new Error("Invalid timezone offset");
  }
  const classId = classDoc._id;
  const warningWindow = resolvePointsBadgeWindow(
    classDoc.warningWindowAmount,
    classDoc.warningWindowUnit,
  );
  const minusWindow = resolvePointsBadgeWindow(
    classDoc.minusWindowAmount,
    classDoc.minusWindowUnit,
  );
  const warningLookback = pointsBadgeLookbackWindow(dateKey, timeZoneOffsetMinutes, warningWindow);
  const minusLookback = pointsBadgeLookbackWindow(dateKey, timeZoneOffsetMinutes, minusWindow);

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded warning ledger
  const warningEvents = await ctx.db
    .query("studentWarningEvents")
    .withIndex("by_classId_dateKey", (q) => q.eq("classId", classId))
    .collect();
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded behavior ledger
  const behaviorApps = await ctx.db
    .query("behaviorApplications")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();

  return {
    warningByStudent: aggregateWarningCountsByStudent(warningEvents, warningLookback),
    minusByStudent: aggregateMinusCountsByStudent(behaviorApps, minusLookback),
  };
}

export const board = classQuery({
  args: {
    dateKey: v.string(),
    timeZoneOffsetMinutes: v.number(),
  },
  returns: v.array(boardStudentValidator),
  handler: async (ctx, args) => {
    await ctx.require("points:manage");
    assertValidDateKey(args.dateKey);
    const classId = ctx.classDoc._id;
    const studentUserIds = await listStudentUserIds(ctx, classId);
    const studentSet = new Set(studentUserIds);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded roster
    const rosterRows = await ctx.db
      .query("studentRosters")
      .withIndex("by_classId_rosterNumber", (q) => q.eq("classId", classId))
      .collect();

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded attendance day
    const attendanceRecords = await ctx.db
      .query("attendanceRecords")
      .withIndex("by_classId_dateKey", (q) => q.eq("classId", classId).eq("dateKey", args.dateKey))
      .collect();
    const attendanceByStudent = new Map(
      attendanceRecords.map((record) => [record.studentUserId, record.status] as const),
    );

    const { warningByStudent, minusByStudent } = await loadBadgeCountsForClass(
      ctx,
      ctx.classDoc,
      args.dateKey,
      args.timeZoneOffsetMinutes,
    );

    const entries: Array<{
      userId: Id<"users">;
      rosterNumber: number;
      firstName?: string;
      lastName?: string;
      name?: string;
      image?: string;
      email?: string;
      gender?:
        | "male"
        | "female"
        | "transMale"
        | "transFemale"
        | "nonBinary"
        | "selfDescribe"
        | "preferNotToSay";
      genderSelfDescribe?: string;
      pronouns?:
        | "heHim"
        | "sheHer"
        | "theyThem"
        | "heThey"
        | "sheThey"
        | "useNameOnly"
        | "askSelfDescribe"
        | "preferNotToSay";
      pronounsSelfDescribe?: string;
      pointsBalance: number;
      pointsAwarded: number;
      pointsRemoved: number;
      pointsRedeemed: number;
      warningCount: number;
      minusCount: number;
      attendanceStatus?: "present" | "absent" | "late";
    }> = [];

    for (const row of rosterRows) {
      if (!studentSet.has(row.userId)) continue;
      const user = await ctx.db.get("users", row.userId);
      if (!user) continue;
      const counters = readRosterPointCounters(row);
      const attendanceStatus = attendanceByStudent.get(row.userId);
      entries.push({
        userId: row.userId,
        rosterNumber: row.rosterNumber,
        firstName: row.firstName,
        lastName: row.lastName,
        name: user.name,
        image: await resolveUserImageUrl(ctx, user),
        email: user.email,
        gender: row.gender,
        genderSelfDescribe: row.genderSelfDescribe,
        pronouns: row.pronouns,
        pronounsSelfDescribe: row.pronounsSelfDescribe,
        pointsBalance: counters.pointsBalance,
        pointsAwarded: counters.pointsAwarded,
        pointsRemoved: counters.pointsRemoved,
        pointsRedeemed: counters.pointsRedeemed,
        warningCount: warningByStudent.get(row.userId) ?? 0,
        minusCount: minusByStudent.get(row.userId) ?? 0,
        ...(attendanceStatus !== undefined ? { attendanceStatus } : {}),
      });
    }

    entries.sort((a, b) => a.rosterNumber - b.rosterNumber);
    return entries;
  },
});

/** Personal/read audience: self (student) or linked students (guardian). */
export const forAudience = classQuery({
  args: {
    dateKey: v.string(),
    timeZoneOffsetMinutes: v.number(),
  },
  returns: v.array(boardStudentValidator),
  handler: async (ctx, args) => {
    await ctx.require("points:read");
    assertValidDateKey(args.dateKey);
    const classId = ctx.classDoc._id;
    const studentUserIds = await resolvePersonalStudentIds(ctx, classId);
    if (studentUserIds.length === 0) {
      return [];
    }

    const audienceSet = new Set(studentUserIds);
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded day; filtered to audience
    const attendanceRecords = await ctx.db
      .query("attendanceRecords")
      .withIndex("by_classId_dateKey", (q) => q.eq("classId", classId).eq("dateKey", args.dateKey))
      .collect();
    const attendanceByStudent = new Map(
      attendanceRecords
        .filter((record) => audienceSet.has(record.studentUserId))
        .map((record) => [record.studentUserId, record.status] as const),
    );

    const { warningByStudent, minusByStudent } = await loadBadgeCountsForClass(
      ctx,
      ctx.classDoc,
      args.dateKey,
      args.timeZoneOffsetMinutes,
    );

    const entries: Array<{
      userId: Id<"users">;
      rosterNumber: number;
      firstName?: string;
      lastName?: string;
      name?: string;
      image?: string;
      email?: string;
      gender?:
        | "male"
        | "female"
        | "transMale"
        | "transFemale"
        | "nonBinary"
        | "selfDescribe"
        | "preferNotToSay";
      genderSelfDescribe?: string;
      pronouns?:
        | "heHim"
        | "sheHer"
        | "theyThem"
        | "heThey"
        | "sheThey"
        | "useNameOnly"
        | "askSelfDescribe"
        | "preferNotToSay";
      pronounsSelfDescribe?: string;
      pointsBalance: number;
      pointsAwarded: number;
      pointsRemoved: number;
      pointsRedeemed: number;
      warningCount: number;
      minusCount: number;
      attendanceStatus?: "present" | "absent" | "late";
    }> = [];

    for (const studentUserId of studentUserIds) {
      const row = await ctx.db
        .query("studentRosters")
        .withIndex("by_classId_userId", (q) => q.eq("classId", classId).eq("userId", studentUserId))
        .unique();
      if (!row) continue;
      const user = await ctx.db.get("users", studentUserId);
      if (!user) continue;
      const counters = readRosterPointCounters(row);
      const attendanceStatus = attendanceByStudent.get(studentUserId);
      entries.push({
        userId: studentUserId,
        rosterNumber: row.rosterNumber,
        firstName: row.firstName,
        lastName: row.lastName,
        name: user.name,
        image: await resolveUserImageUrl(ctx, user),
        email: user.email,
        gender: row.gender,
        genderSelfDescribe: row.genderSelfDescribe,
        pronouns: row.pronouns,
        pronounsSelfDescribe: row.pronounsSelfDescribe,
        pointsBalance: counters.pointsBalance,
        pointsAwarded: counters.pointsAwarded,
        pointsRemoved: counters.pointsRemoved,
        pointsRedeemed: counters.pointsRedeemed,
        warningCount: warningByStudent.get(studentUserId) ?? 0,
        minusCount: minusByStudent.get(studentUserId) ?? 0,
        ...(attendanceStatus !== undefined ? { attendanceStatus } : {}),
      });
    }

    entries.sort((a, b) => a.rosterNumber - b.rosterNumber);
    return entries;
  },
});

const ledgerBehaviorItemValidator = v.object({
  kind: v.literal("behavior"),
  id: v.id("behaviorApplications"),
  at: v.number(),
  name: v.optional(v.string()),
  pointsApplied: v.number(),
  quantity: v.number(),
});

const ledgerRewardItemValidator = v.object({
  kind: v.literal("reward"),
  id: v.id("rewardPurchases"),
  at: v.number(),
  name: v.optional(v.string()),
  pointsCost: v.number(),
  quantity: v.number(),
});

const ledgerWarningItemValidator = v.object({
  kind: v.literal("warning"),
  id: v.id("studentWarningEvents"),
  at: v.number(),
  dateKey: v.string(),
});

/** Newest-first points ledger for one personal-audience student. */
export const ledgerForAudience = classQuery({
  args: {
    studentUserId: v.id("users"),
    beforeTimestamp: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    items: v.array(
      v.union(ledgerBehaviorItemValidator, ledgerRewardItemValidator, ledgerWarningItemValidator),
    ),
    nextBeforeTimestamp: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    await ctx.require("points:read");
    const classId = ctx.classDoc._id;
    await assertPersonalStudentAccess(ctx, classId, args.studentUserId);

    const limit = Math.min(
      Math.max(1, Math.floor(args.limit ?? DEFAULT_LEDGER_LIMIT)),
      MAX_LEDGER_LIMIT,
    );
    const beforeTimestamp = args.beforeTimestamp;

    const behaviorRows =
      beforeTimestamp === undefined
        ? await ctx.db
            .query("behaviorApplications")
            .withIndex("by_classId_student_awardedAt", (q) =>
              q.eq("classId", classId).eq("studentUserId", args.studentUserId),
            )
            .order("desc")
            .take(limit)
        : await ctx.db
            .query("behaviorApplications")
            .withIndex("by_classId_student_awardedAt", (q) =>
              q
                .eq("classId", classId)
                .eq("studentUserId", args.studentUserId)
                .lt("awardedAt", beforeTimestamp),
            )
            .order("desc")
            .take(limit);

    const rewardRows =
      beforeTimestamp === undefined
        ? await ctx.db
            .query("rewardPurchases")
            .withIndex("by_classId_student_purchasedAt", (q) =>
              q.eq("classId", classId).eq("studentUserId", args.studentUserId),
            )
            .order("desc")
            .take(limit)
        : await ctx.db
            .query("rewardPurchases")
            .withIndex("by_classId_student_purchasedAt", (q) =>
              q
                .eq("classId", classId)
                .eq("studentUserId", args.studentUserId)
                .lt("purchasedAt", beforeTimestamp),
            )
            .order("desc")
            .take(limit);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- per-student warning ledger is classroom-bounded
    const warningRows = await ctx.db
      .query("studentWarningEvents")
      .withIndex("by_classId_student_dateKey", (q) =>
        q.eq("classId", classId).eq("studentUserId", args.studentUserId),
      )
      .collect();

    type MergedItem =
      | {
          kind: "behavior";
          id: Id<"behaviorApplications">;
          at: number;
          name?: string;
          pointsApplied: number;
          quantity: number;
        }
      | {
          kind: "reward";
          id: Id<"rewardPurchases">;
          at: number;
          name?: string;
          pointsCost: number;
          quantity: number;
        }
      | {
          kind: "warning";
          id: Id<"studentWarningEvents">;
          at: number;
          dateKey: string;
        };

    const merged: MergedItem[] = [];

    for (const row of behaviorRows) {
      const behavior = await ctx.db.get("behaviors", row.behaviorId);
      merged.push({
        kind: "behavior",
        id: row._id,
        at: row.awardedAt,
        ...(behavior?.name ? { name: behavior.name } : {}),
        pointsApplied: row.pointsApplied,
        quantity: ledgerQuantity(row.quantity),
      });
    }

    for (const row of rewardRows) {
      const reward = await ctx.db.get("rewards", row.rewardId);
      merged.push({
        kind: "reward",
        id: row._id,
        at: row.purchasedAt,
        ...(reward?.name ? { name: reward.name } : {}),
        pointsCost: row.pointsCost,
        quantity: ledgerQuantity(row.quantity),
      });
    }

    for (const row of warningRows) {
      if (beforeTimestamp !== undefined && row.createdAt >= beforeTimestamp) continue;
      merged.push({
        kind: "warning",
        id: row._id,
        at: row.createdAt,
        dateKey: row.dateKey,
      });
    }

    merged.sort((a, b) => b.at - a.at);
    const items = merged.slice(0, limit);

    return {
      items,
      ...(items.length === limit ? { nextBeforeTimestamp: items[items.length - 1]?.at } : {}),
    };
  },
});

/** Backfill missing roster point/warning counters (idempotent). */
export const ensureCounters = classMutation({
  args: {},
  returns: v.object({ patched: v.number() }),
  handler: async (ctx) => {
    await rateLimiter.limit(ctx, "rosterEnsure", { key: ctx.userId, throws: true });
    await ctx.require("points:manage");
    const patched = await ensureRosterPointCounters(ctx, ctx.classDoc._id);
    return { patched };
  },
});

export const applyBehaviors = classMutation({
  args: {
    studentUserIds: v.array(v.id("users")),
    mode: v.union(v.literal("award"), v.literal("remove")),
    items: v.array(
      v.object({
        behaviorId: v.id("behaviors"),
        quantity: v.number(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "pointsApplyBehaviors", { key: ctx.userId, throws: true });
    await ctx.require("points:manage");
    const classId = ctx.classDoc._id;
    await requireStudentsInClass(ctx, classId, args.studentUserIds);

    if (args.items.length === 0) {
      throw new Error("Select at least one behavior");
    }
    if (args.items.length > MAX_ITEMS_PER_APPLY) {
      throw new Error(`Too many behaviors (max ${MAX_ITEMS_PER_APPLY})`);
    }

    const now = Date.now();
    for (const item of args.items) {
      const quantity = normalizeQuantity(item.quantity);
      const behavior = await ctx.db.get("behaviors", item.behaviorId);
      if (!behavior || behavior.classId !== classId) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Behavior not found" });
      }
      if (args.mode === "award" && behavior.points <= 0) {
        throw new Error(`"${behavior.name}" is not an award behavior`);
      }
      if (args.mode === "remove" && behavior.points >= 0) {
        throw new Error(`"${behavior.name}" is not a remove behavior`);
      }
      const pointsApplied = behavior.points * quantity;
      for (const studentUserId of args.studentUserIds) {
        await ctx.db.insert("behaviorApplications", {
          classId,
          behaviorId: behavior._id,
          studentUserId,
          pointsApplied,
          quantity,
          awardedBy: ctx.userId,
          awardedAt: now,
        });
        await applyBehaviorPointsDelta(ctx, classId, studentUserId, pointsApplied, 1);
      }
    }

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "behaviorApplication",
      summary: `Applied ${args.items.length} behavior(s) to ${args.studentUserIds.length} student(s)`,
      summaryKey: "activitySummary_appliedBehaviors",
      metadata: {
        mode: args.mode,
        studentCount: String(args.studentUserIds.length),
        itemCount: String(args.items.length),
      },
    });

    return null;
  },
});

export const rewardPurchaseLimits = classQuery({
  args: {
    studentUserIds: v.array(v.id("users")),
    timeZoneOffsetMinutes: v.number(),
  },
  returns: v.array(rewardPurchaseLimitStatusValidator),
  handler: async (ctx, args) => {
    await ctx.require("points:manage");
    const classId = ctx.classDoc._id;
    if (args.studentUserIds.length === 0) return [];
    if (args.studentUserIds.length > MAX_STUDENTS_PER_APPLY) {
      throw new Error(`Too many students (max ${MAX_STUDENTS_PER_APPLY})`);
    }
    if (!Number.isFinite(args.timeZoneOffsetMinutes)) {
      throw new Error("Invalid timezone offset");
    }

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded catalog
    const rewards = await ctx.db
      .query("rewards")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded folders
    const folders = await ctx.db
      .query("rewardFolders")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();
    const foldersById = new Map(folders.map((folder) => [folder._id, folder] as const));

    const now = Date.now();
    const statuses: Array<{
      studentUserId: Id<"users">;
      rewardId: Id<"rewards">;
      usedInWindow: number;
      kind: "item" | "folder";
      maxPurchases: number;
      period: "day" | "week" | "month";
      every: number;
      folderId?: Id<"rewardFolders">;
    }> = [];

    for (const studentUserId of args.studentUserIds) {
      // eslint-disable-next-line @convex-dev/no-collect-in-query -- student-scoped ledger
      const purchases = await ctx.db
        .query("rewardPurchases")
        .withIndex("by_classId_student", (q) =>
          q.eq("classId", classId).eq("studentUserId", studentUserId),
        )
        .collect();

      const usedByPool = new Map<string, number>();

      for (const reward of rewards) {
        const effective = effectivePurchaseLimitForReward(reward, rewards, foldersById);
        if (!effective) continue;
        const poolId = effective.kind === "item" ? String(reward._id) : String(effective.folderId);
        const poolKey = purchaseLimitPoolKey(effective.kind, poolId);
        if (!usedByPool.has(poolKey)) {
          const window = purchaseLimitWindow(now, effective.limit, args.timeZoneOffsetMinutes);
          const poolSet = new Set(effective.poolRewardIds.map(String));
          let used = 0;
          for (const purchase of purchases) {
            if (!poolSet.has(String(purchase.rewardId))) continue;
            if (!isTimestampInPurchaseLimitWindow(purchase.purchasedAt, window)) continue;
            used += ledgerQuantity(purchase.quantity);
          }
          usedByPool.set(poolKey, used);
        }

        statuses.push({
          studentUserId,
          rewardId: reward._id,
          usedInWindow: usedByPool.get(poolKey) ?? 0,
          kind: effective.kind,
          maxPurchases: effective.limit.maxPurchases,
          period: effective.limit.period,
          every: effective.limit.every,
          ...(effective.folderId !== undefined ? { folderId: effective.folderId } : {}),
        });
      }
    }

    return statuses;
  },
});

export const redeemRewards = classMutation({
  args: {
    studentUserIds: v.array(v.id("users")),
    items: v.array(
      v.object({
        rewardId: v.id("rewards"),
        quantity: v.number(),
      }),
    ),
    timeZoneOffsetMinutes: v.number(),
    /** Teacher override: skip points-balance and purchase-limit checks for this apply. */
    allowOverride: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "pointsRedeemRewards", { key: ctx.userId, throws: true });
    await ctx.require("points:manage");
    const classId = ctx.classDoc._id;
    await requireStudentsInClass(ctx, classId, args.studentUserIds);

    if (args.items.length === 0) {
      throw new Error("Select at least one reward");
    }
    if (args.items.length > MAX_ITEMS_PER_APPLY) {
      throw new Error(`Too many rewards (max ${MAX_ITEMS_PER_APPLY})`);
    }
    if (!Number.isFinite(args.timeZoneOffsetMinutes)) {
      throw new Error("Invalid timezone offset");
    }

    const allowOverride = args.allowOverride === true;

    let totalCost = 0;
    const resolved: Array<{
      rewardId: Id<"rewards">;
      name: string;
      quantity: number;
      pointsCost: number;
    }> = [];
    for (const item of args.items) {
      const quantity = normalizeQuantity(item.quantity);
      const reward = await ctx.db.get("rewards", item.rewardId);
      if (!reward || reward.classId !== classId) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Reward not found" });
      }
      const pointsCost = reward.points * quantity;
      totalCost += pointsCost;
      resolved.push({
        rewardId: reward._id,
        name: reward.name,
        quantity,
        pointsCost,
      });
    }

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded catalog
    const allRewards = await ctx.db
      .query("rewards")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded folders
    const folders = await ctx.db
      .query("rewardFolders")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();
    const foldersById = new Map(folders.map((folder) => [folder._id, folder] as const));
    const now = Date.now();

    for (const studentUserId of args.studentUserIds) {
      const row = await requireRosterRow(ctx, classId, studentUserId);
      const balance = readRosterPointCounters(row).pointsBalance;
      if (!allowOverride && balance < totalCost) {
        throw new Error("Insufficient points to redeem");
      }

      if (allowOverride) continue;

      // eslint-disable-next-line @convex-dev/no-collect-in-query -- student-scoped ledger
      const purchases = await ctx.db
        .query("rewardPurchases")
        .withIndex("by_classId_student", (q) =>
          q.eq("classId", classId).eq("studentUserId", studentUserId),
        )
        .collect();

      const usedByPool = new Map<string, number>();

      for (const item of resolved) {
        const reward = allRewards.find((entry) => entry._id === item.rewardId);
        if (!reward) continue;
        const effective = effectivePurchaseLimitForReward(reward, allRewards, foldersById);
        if (!effective) continue;

        const poolId =
          effective.kind === "item" ? String(item.rewardId) : String(effective.folderId);
        const poolKey = purchaseLimitPoolKey(effective.kind, poolId);

        let used = usedByPool.get(poolKey);
        if (used === undefined) {
          const window = purchaseLimitWindow(now, effective.limit, args.timeZoneOffsetMinutes);
          const poolSet = new Set(effective.poolRewardIds.map(String));
          used = 0;
          for (const purchase of purchases) {
            if (!poolSet.has(String(purchase.rewardId))) continue;
            if (!isTimestampInPurchaseLimitWindow(purchase.purchasedAt, window)) continue;
            used += ledgerQuantity(purchase.quantity);
          }
          usedByPool.set(poolKey, used);
        }

        if (used + item.quantity > effective.limit.maxPurchases) {
          throw new Error(`Purchase limit reached for "${item.name}"`);
        }
        usedByPool.set(poolKey, used + item.quantity);
      }
    }
    for (const item of resolved) {
      for (const studentUserId of args.studentUserIds) {
        await ctx.db.insert("rewardPurchases", {
          classId,
          rewardId: item.rewardId,
          studentUserId,
          pointsCost: item.pointsCost,
          quantity: item.quantity,
          purchasedBy: ctx.userId,
          purchasedAt: now,
        });
        await applyRewardPointsDelta(ctx, classId, studentUserId, item.pointsCost, 1);
      }
    }

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "rewardPurchase",
      summary: `Redeemed ${args.items.length} reward(s) for ${args.studentUserIds.length} student(s)`,
      summaryKey: "activitySummary_redeemedRewards",
      metadata: {
        studentCount: String(args.studentUserIds.length),
        itemCount: String(args.items.length),
        totalCost: String(totalCost),
        ...(allowOverride ? { allowOverride: "true" } : {}),
      },
    });

    return null;
  },
});

export const undoLastPointsAction = classMutation({
  args: {
    studentUserId: v.id("users"),
  },
  returns: v.object({
    kind: v.union(v.literal("behavior"), v.literal("purchase"), v.literal("none")),
  }),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "pointsUndoLastAction", { key: ctx.userId, throws: true });
    await ctx.require("points:manage");
    const classId = ctx.classDoc._id;
    await requireStudentInClass(ctx, classId, args.studentUserId);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- student-scoped recent ledger
    const applications = await ctx.db
      .query("behaviorApplications")
      .withIndex("by_classId_student", (q) =>
        q.eq("classId", classId).eq("studentUserId", args.studentUserId),
      )
      .collect();
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- student-scoped recent ledger
    const purchases = await ctx.db
      .query("rewardPurchases")
      .withIndex("by_classId_student", (q) =>
        q.eq("classId", classId).eq("studentUserId", args.studentUserId),
      )
      .collect();

    let latestBehavior: (typeof applications)[number] | null = null;
    for (const application of applications) {
      if (!latestBehavior || application.awardedAt > latestBehavior.awardedAt) {
        latestBehavior = application;
      }
    }
    let latestPurchase: (typeof purchases)[number] | null = null;
    for (const purchase of purchases) {
      if (!latestPurchase || purchase.purchasedAt > latestPurchase.purchasedAt) {
        latestPurchase = purchase;
      }
    }

    if (!latestBehavior && !latestPurchase) {
      return { kind: "none" as const };
    }

    const undoBehavior =
      latestBehavior && (!latestPurchase || latestBehavior.awardedAt >= latestPurchase.purchasedAt);

    if (undoBehavior && latestBehavior) {
      await applyBehaviorPointsDelta(
        ctx,
        classId,
        args.studentUserId,
        latestBehavior.pointsApplied,
        -1,
      );
      await ctx.db.delete("behaviorApplications", latestBehavior._id);
      await recordClassActivity(ctx, {
        classId,
        actorUserId: ctx.userId,
        action: "delete",
        resourceType: "behaviorApplication",
        resourceId: latestBehavior._id,
        summary: "Undid last behavior application",
        summaryKey: "activitySummary_undidLastPointsAction",
        metadata: {
          kind: "behavior",
          studentUserId: args.studentUserId,
        },
      });
      return { kind: "behavior" as const };
    }

    if (latestPurchase) {
      await applyRewardPointsDelta(ctx, classId, args.studentUserId, latestPurchase.pointsCost, -1);
      await ctx.db.delete("rewardPurchases", latestPurchase._id);
      await recordClassActivity(ctx, {
        classId,
        actorUserId: ctx.userId,
        action: "delete",
        resourceType: "rewardPurchase",
        resourceId: latestPurchase._id,
        summary: "Undid last reward purchase",
        summaryKey: "activitySummary_undidLastPointsAction",
        metadata: {
          kind: "purchase",
          studentUserId: args.studentUserId,
        },
      });
      return { kind: "purchase" as const };
    }

    return { kind: "none" as const };
  },
});

export const giveWarning = classMutation({
  args: {
    studentUserId: v.id("users"),
    dateKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "pointsGiveWarning", { key: ctx.userId, throws: true });
    await ctx.require("points:manage");
    assertValidDateKey(args.dateKey);
    const classId = ctx.classDoc._id;
    await requireStudentInClass(ctx, classId, args.studentUserId);

    const now = Date.now();
    await ctx.db.insert("studentWarningEvents", {
      classId,
      studentUserId: args.studentUserId,
      dateKey: args.dateKey,
      createdBy: ctx.userId,
      createdAt: now,
    });

    const row = await requireRosterRow(ctx, classId, args.studentUserId);
    const current = row.warningDateKey === args.dateKey ? (row.warningCount ?? 0) : 0;
    await ctx.db.patch("studentRosters", row._id, {
      warningCount: current + 1,
      warningDateKey: args.dateKey,
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "studentWarning",
      resourceId: args.studentUserId,
      summary: `Gave warning for ${args.dateKey}`,
      summaryKey: "activitySummary_gaveWarning",
      metadata: {
        dateKey: args.dateKey,
        studentUserId: args.studentUserId,
      },
    });

    return null;
  },
});

export const undoLastWarning = classMutation({
  args: {
    studentUserId: v.id("users"),
    dateKey: v.string(),
  },
  returns: v.object({ undone: v.boolean() }),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "pointsUndoWarning", { key: ctx.userId, throws: true });
    await ctx.require("points:manage");
    assertValidDateKey(args.dateKey);
    const classId = ctx.classDoc._id;
    await requireStudentInClass(ctx, classId, args.studentUserId);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- student+day scoped
    const events = await ctx.db
      .query("studentWarningEvents")
      .withIndex("by_classId_student_dateKey", (q) =>
        q
          .eq("classId", classId)
          .eq("studentUserId", args.studentUserId)
          .eq("dateKey", args.dateKey),
      )
      .collect();

    if (events.length === 0) {
      return { undone: false };
    }

    let latest = events[0];
    for (const event of events) {
      if (event.createdAt > latest.createdAt) latest = event;
    }
    await ctx.db.delete("studentWarningEvents", latest._id);

    const row = await requireRosterRow(ctx, classId, args.studentUserId);
    const remaining = events.length - 1;
    await ctx.db.patch("studentRosters", row._id, {
      warningCount: remaining,
      warningDateKey: remaining > 0 ? args.dateKey : undefined,
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "studentWarning",
      resourceId: args.studentUserId,
      summary: `Undid last warning for ${args.dateKey}`,
      summaryKey: "activitySummary_undidLastWarning",
      metadata: {
        dateKey: args.dateKey,
        studentUserId: args.studentUserId,
      },
    });

    return { undone: true };
  },
});

export const clearWarnings = classMutation({
  args: {
    studentUserId: v.id("users"),
    dateKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "pointsClearWarnings", { key: ctx.userId, throws: true });
    await ctx.require("points:manage");
    assertValidDateKey(args.dateKey);
    const classId = ctx.classDoc._id;
    await requireStudentInClass(ctx, classId, args.studentUserId);

    // eslint-disable-next-line @convex-dev/no-collect-in-query -- student+day scoped
    const events = await ctx.db
      .query("studentWarningEvents")
      .withIndex("by_classId_student_dateKey", (q) =>
        q
          .eq("classId", classId)
          .eq("studentUserId", args.studentUserId)
          .eq("dateKey", args.dateKey),
      )
      .collect();
    for (const event of events) {
      await ctx.db.delete("studentWarningEvents", event._id);
    }

    const row = await requireRosterRow(ctx, classId, args.studentUserId);
    await ctx.db.patch("studentRosters", row._id, {
      warningCount: 0,
      warningDateKey: undefined,
    });

    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "studentWarning",
      resourceId: args.studentUserId,
      summary: `Cleared warnings for ${args.dateKey}`,
      summaryKey: "activitySummary_clearedWarnings",
      metadata: {
        dateKey: args.dateKey,
        studentUserId: args.studentUserId,
        clearedCount: String(events.length),
      },
    });

    return null;
  },
});
