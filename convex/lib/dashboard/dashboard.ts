import type { Id } from "../../_generated/dataModel.js";
import type { QueryCtx } from "../../_generated/server.js";
import type { ConsumerAssignerRunAssignment } from "../assigners/runAssignmentProjection.js";

export type DashboardSeatCurrent = {
  recordedAt: number;
  chartName: string;
  layoutName: string;
  deskNumber?: number;
  zoneName?: string;
  teamLabel?: string;
  neighborDisplayNames: string[];
};

export type DashboardAssignerAssignment = {
  item: string;
  groupName?: string;
  ranAt: number;
  runId: Id<"randomAssignerRuns"> | Id<"equitableAssignerRuns">;
};

export type DashboardAssignerRow = {
  kind: "random" | "equitable";
  assignerId: Id<"randomAssigners"> | Id<"equitableAssigners">;
  name: string;
  latestRunId: Id<"randomAssignerRuns"> | Id<"equitableAssignerRuns"> | null;
  latestRunAt: number | null;
  assignment: DashboardAssignerAssignment | null;
};

export type DashboardAssignerSnapshot = {
  seatCurrent: DashboardSeatCurrent | null;
  assigners: DashboardAssignerRow[];
};

async function loadLatestSeatCurrent(
  ctx: QueryCtx,
  classId: Id<"classes">,
  studentUserId: Id<"users">,
): Promise<DashboardSeatCurrent | null> {
  const latest = await ctx.db
    .query("seatChartPlacements")
    .withIndex("by_classId_student_recorded", (q) =>
      q.eq("classId", classId).eq("studentUserId", studentUserId),
    )
    .order("desc")
    .first();
  if (!latest) return null;

  const latestRecord = await ctx.db.get("seatChartRecords", latest.recordId);
  if (!latestRecord) return null;

  return {
    recordedAt: latest.recordedAt,
    chartName: latestRecord.chartName,
    layoutName: latestRecord.layoutName,
    ...(latest.deskNumber !== undefined ? { deskNumber: latest.deskNumber } : {}),
    ...(latest.zoneName !== undefined ? { zoneName: latest.zoneName } : {}),
    ...(latest.teamLabel !== undefined ? { teamLabel: latest.teamLabel } : {}),
    neighborDisplayNames: latest.neighborDisplayNames,
  };
}

function findPersonalAssignment(
  assignments: readonly ConsumerAssignerRunAssignment[],
  studentUserId: Id<"users">,
): Omit<DashboardAssignerAssignment, "runId" | "ranAt"> | null {
  const match = assignments.find((row) => row.studentUserId === studentUserId);
  if (!match) return null;
  return {
    item: match.item,
    ...(match.groupName !== undefined ? { groupName: match.groupName } : {}),
  };
}

async function loadRandomAssignerRows(
  ctx: QueryCtx,
  classId: Id<"classes">,
  studentUserId: Id<"users">,
): Promise<DashboardAssignerRow[]> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
  const rows = await ctx.db
    .query("randomAssigners")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  rows.sort((a, b) => a.name.localeCompare(b.name));

  const result: DashboardAssignerRow[] = [];
  for (const row of rows) {
    const latestRun = await ctx.db
      .query("randomAssignerRuns")
      .withIndex("by_assignerId_ranAt", (q) => q.eq("assignerId", row._id))
      .order("desc")
      .first();

    const personal = latestRun
      ? findPersonalAssignment(latestRun.assignments, studentUserId)
      : null;

    result.push({
      kind: "random",
      assignerId: row._id,
      name: row.name,
      latestRunId: latestRun?._id ?? null,
      latestRunAt: latestRun?.ranAt ?? null,
      assignment:
        latestRun && personal
          ? {
              ...personal,
              ranAt: latestRun.ranAt,
              runId: latestRun._id,
            }
          : null,
    });
  }
  return result;
}

async function loadEquitableAssignerRows(
  ctx: QueryCtx,
  classId: Id<"classes">,
  studentUserId: Id<"users">,
): Promise<DashboardAssignerRow[]> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded list
  const rows = await ctx.db
    .query("equitableAssigners")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  rows.sort((a, b) => a.name.localeCompare(b.name));

  const result: DashboardAssignerRow[] = [];
  for (const row of rows) {
    const latestRun = await ctx.db
      .query("equitableAssignerRuns")
      .withIndex("by_assignerId_ranAt", (q) => q.eq("assignerId", row._id))
      .order("desc")
      .first();

    const personal = latestRun
      ? findPersonalAssignment(latestRun.assignments, studentUserId)
      : null;

    result.push({
      kind: "equitable",
      assignerId: row._id,
      name: row.name,
      latestRunId: latestRun?._id ?? null,
      latestRunAt: latestRun?.ranAt ?? null,
      assignment:
        latestRun && personal
          ? {
              ...personal,
              ranAt: latestRun.ranAt,
              runId: latestRun._id,
            }
          : null,
    });
  }
  return result;
}

export async function buildAssignerSnapshotForAudience(
  ctx: QueryCtx,
  classId: Id<"classes">,
  studentUserId: Id<"users">,
): Promise<DashboardAssignerSnapshot> {
  const [seatCurrent, randomRows, equitableRows] = await Promise.all([
    loadLatestSeatCurrent(ctx, classId, studentUserId),
    loadRandomAssignerRows(ctx, classId, studentUserId),
    loadEquitableAssignerRows(ctx, classId, studentUserId),
  ]);

  return {
    seatCurrent,
    assigners: [...randomRows, ...equitableRows],
  };
}
