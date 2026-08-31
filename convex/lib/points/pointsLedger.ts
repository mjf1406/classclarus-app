import { v } from "convex/values";

import type { Id } from "../../_generated/dataModel.js";
import type { QueryCtx } from "../../_generated/server.js";
import {
  getNewestActivityRevision,
  LEDGER_REVISION_RESOURCE_TYPES,
  type ActivityRevision,
} from "../activity/classActivity.js";
import { ledgerQuantity } from "./pointsRoster.js";

export const DEFAULT_LEDGER_LIMIT = 40;
export const MAX_LEDGER_LIMIT = 100;

export const ledgerBehaviorItemValidator = v.object({
  kind: v.literal("behavior"),
  id: v.id("behaviorApplications"),
  at: v.number(),
  name: v.optional(v.string()),
  pointsApplied: v.number(),
  quantity: v.number(),
  note: v.optional(v.string()),
});

export const ledgerRewardItemValidator = v.object({
  kind: v.literal("reward"),
  id: v.id("rewardPurchases"),
  at: v.number(),
  name: v.optional(v.string()),
  pointsCost: v.number(),
  quantity: v.number(),
});

export const ledgerWarningItemValidator = v.object({
  kind: v.literal("warning"),
  id: v.id("studentWarningEvents"),
  at: v.number(),
  dateKey: v.string(),
});

export const ledgerItemValidator = v.union(
  ledgerBehaviorItemValidator,
  ledgerRewardItemValidator,
  ledgerWarningItemValidator,
);

export const activityRevisionValidator = v.union(
  v.object({
    eventId: v.id("classActivityEvents"),
    createdAt: v.number(),
  }),
  v.null(),
);

export const ledgerPageValidator = v.object({
  items: v.array(ledgerItemValidator),
  nextBeforeTimestamp: v.optional(v.number()),
  revision: activityRevisionValidator,
});

export type PointsLedgerItem =
  | {
      kind: "behavior";
      id: Id<"behaviorApplications">;
      at: number;
      name?: string;
      pointsApplied: number;
      quantity: number;
      note?: string;
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

export type PointsLedgerPage = {
  items: PointsLedgerItem[];
  nextBeforeTimestamp?: number;
  revision: ActivityRevision | null;
};

export function normalizeLedgerLimit(limit: number | undefined): number {
  return Math.min(Math.max(1, Math.floor(limit ?? DEFAULT_LEDGER_LIMIT)), MAX_LEDGER_LIMIT);
}

/** Newest-first merged behavior / reward / warning ledger for one student. */
export async function loadStudentPointsLedger(
  ctx: Pick<QueryCtx, "db">,
  classId: Id<"classes">,
  studentUserId: Id<"users">,
  args: { beforeTimestamp?: number; limit?: number },
): Promise<PointsLedgerPage> {
  const limit = normalizeLedgerLimit(args.limit);
  const beforeTimestamp = args.beforeTimestamp;
  const revision = await getNewestActivityRevision(ctx, classId, LEDGER_REVISION_RESOURCE_TYPES);

  const behaviorRows =
    beforeTimestamp === undefined
      ? await ctx.db
          .query("behaviorApplications")
          .withIndex("by_classId_student_awardedAt", (q) =>
            q.eq("classId", classId).eq("studentUserId", studentUserId),
          )
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("behaviorApplications")
          .withIndex("by_classId_student_awardedAt", (q) =>
            q
              .eq("classId", classId)
              .eq("studentUserId", studentUserId)
              .lt("awardedAt", beforeTimestamp),
          )
          .order("desc")
          .take(limit);

  const rewardRows =
    beforeTimestamp === undefined
      ? await ctx.db
          .query("rewardPurchases")
          .withIndex("by_classId_student_purchasedAt", (q) =>
            q.eq("classId", classId).eq("studentUserId", studentUserId),
          )
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("rewardPurchases")
          .withIndex("by_classId_student_purchasedAt", (q) =>
            q
              .eq("classId", classId)
              .eq("studentUserId", studentUserId)
              .lt("purchasedAt", beforeTimestamp),
          )
          .order("desc")
          .take(limit);

  const warningRows =
    beforeTimestamp === undefined
      ? await ctx.db
          .query("studentWarningEvents")
          .withIndex("by_classId_student_createdAt", (q) =>
            q.eq("classId", classId).eq("studentUserId", studentUserId),
          )
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("studentWarningEvents")
          .withIndex("by_classId_student_createdAt", (q) =>
            q
              .eq("classId", classId)
              .eq("studentUserId", studentUserId)
              .lt("createdAt", beforeTimestamp),
          )
          .order("desc")
          .take(limit);

  const merged: PointsLedgerItem[] = [];

  for (const row of behaviorRows) {
    const behavior = await ctx.db.get("behaviors", row.behaviorId);
    merged.push({
      kind: "behavior",
      id: row._id,
      at: row.awardedAt,
      ...(behavior?.name ? { name: behavior.name } : {}),
      pointsApplied: row.pointsApplied,
      quantity: ledgerQuantity(row.quantity),
      ...(row.note ? { note: row.note } : {}),
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
    revision,
    ...(items.length === limit ? { nextBeforeTimestamp: items[items.length - 1]?.at } : {}),
  };
}
