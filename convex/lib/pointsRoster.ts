import type { Doc, Id } from "../_generated/dataModel.js";
import type { MutationCtx } from "../_generated/server.js";

export type RosterPointCounters = {
  pointsBalance: number;
  pointsAwarded: number;
  pointsRemoved: number;
  pointsRedeemed: number;
};

export function ledgerQuantity(quantity: number | undefined): number {
  return quantity !== undefined && quantity > 0 ? quantity : 1;
}

export function readRosterPointCounters(
  row: Pick<
    Doc<"studentRosters">,
    "pointsBalance" | "pointsAwarded" | "pointsRemoved" | "pointsRedeemed"
  >,
): RosterPointCounters {
  return {
    pointsBalance: row.pointsBalance ?? 0,
    pointsAwarded: row.pointsAwarded ?? 0,
    pointsRemoved: row.pointsRemoved ?? 0,
    pointsRedeemed: row.pointsRedeemed ?? 0,
  };
}

export function effectiveWarningCount(
  row: Pick<Doc<"studentRosters">, "warningCount" | "warningDateKey">,
  dateKey: string,
): number {
  if (row.warningDateKey !== dateKey) return 0;
  return row.warningCount ?? 0;
}

async function getRosterRow(
  ctx: MutationCtx,
  classId: Id<"classes">,
  studentUserId: Id<"users">,
): Promise<Doc<"studentRosters"> | null> {
  return await ctx.db
    .query("studentRosters")
    .withIndex("by_classId_userId", (q) => q.eq("classId", classId).eq("userId", studentUserId))
    .unique();
}

export async function requireRosterRow(
  ctx: MutationCtx,
  classId: Id<"classes">,
  studentUserId: Id<"users">,
): Promise<Doc<"studentRosters">> {
  const row = await getRosterRow(ctx, classId, studentUserId);
  if (!row) {
    throw new Error("Roster row missing");
  }
  return row;
}

export async function patchRosterPointCounters(
  ctx: MutationCtx,
  classId: Id<"classes">,
  studentUserId: Id<"users">,
  delta: Partial<RosterPointCounters>,
): Promise<RosterPointCounters | null> {
  const row = await getRosterRow(ctx, classId, studentUserId);
  // Class delete may remove roster rows before ledger cleanup.
  if (!row) return null;
  const current = readRosterPointCounters(row);
  const next: RosterPointCounters = {
    pointsBalance: current.pointsBalance + (delta.pointsBalance ?? 0),
    pointsAwarded: current.pointsAwarded + (delta.pointsAwarded ?? 0),
    pointsRemoved: current.pointsRemoved + (delta.pointsRemoved ?? 0),
    pointsRedeemed: current.pointsRedeemed + (delta.pointsRedeemed ?? 0),
  };
  await ctx.db.patch("studentRosters", row._id, next);
  return next;
}

/** Apply a behavior ledger delta (positive or negative pointsApplied). */
export async function applyBehaviorPointsDelta(
  ctx: MutationCtx,
  classId: Id<"classes">,
  studentUserId: Id<"users">,
  pointsApplied: number,
  direction: 1 | -1,
): Promise<void> {
  const signed = pointsApplied * direction;
  if (pointsApplied > 0) {
    await patchRosterPointCounters(ctx, classId, studentUserId, {
      pointsBalance: signed,
      pointsAwarded: pointsApplied * direction,
    });
    return;
  }
  if (pointsApplied < 0) {
    const removed = Math.abs(pointsApplied);
    await patchRosterPointCounters(ctx, classId, studentUserId, {
      pointsBalance: signed,
      pointsRemoved: removed * direction,
    });
    return;
  }
}

/** Apply a reward purchase cost delta (non-negative pointsCost). */
export async function applyRewardPointsDelta(
  ctx: MutationCtx,
  classId: Id<"classes">,
  studentUserId: Id<"users">,
  pointsCost: number,
  direction: 1 | -1,
): Promise<void> {
  if (pointsCost === 0) return;
  await patchRosterPointCounters(ctx, classId, studentUserId, {
    pointsBalance: -pointsCost * direction,
    pointsRedeemed: pointsCost * direction,
  });
}

/** Adjust counters when a ledger row's points snapshot changes (retroactive catalog edit). */
export async function adjustBehaviorPointsRewrite(
  ctx: MutationCtx,
  classId: Id<"classes">,
  studentUserId: Id<"users">,
  oldPointsApplied: number,
  newPointsApplied: number,
): Promise<void> {
  if (oldPointsApplied === newPointsApplied) return;
  await applyBehaviorPointsDelta(ctx, classId, studentUserId, oldPointsApplied, -1);
  await applyBehaviorPointsDelta(ctx, classId, studentUserId, newPointsApplied, 1);
}

export async function adjustRewardPointsRewrite(
  ctx: MutationCtx,
  classId: Id<"classes">,
  studentUserId: Id<"users">,
  oldPointsCost: number,
  newPointsCost: number,
): Promise<void> {
  if (oldPointsCost === newPointsCost) return;
  await applyRewardPointsDelta(ctx, classId, studentUserId, oldPointsCost, -1);
  await applyRewardPointsDelta(ctx, classId, studentUserId, newPointsCost, 1);
}

export async function ensureRosterPointCounters(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<number> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded backfill
  const rows = await ctx.db
    .query("studentRosters")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  let patched = 0;
  for (const row of rows) {
    if (
      row.pointsBalance !== undefined &&
      row.pointsAwarded !== undefined &&
      row.pointsRemoved !== undefined &&
      row.pointsRedeemed !== undefined &&
      row.warningCount !== undefined
    ) {
      continue;
    }
    await ctx.db.patch("studentRosters", row._id, {
      pointsBalance: row.pointsBalance ?? 0,
      pointsAwarded: row.pointsAwarded ?? 0,
      pointsRemoved: row.pointsRemoved ?? 0,
      pointsRedeemed: row.pointsRedeemed ?? 0,
      warningCount: row.warningCount ?? 0,
    });
    patched += 1;
  }
  return patched;
}
