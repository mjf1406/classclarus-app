import { v } from "convex/values";

import { classQuery } from "./lib/customFunctions.js";
import { buildAssignerSnapshotForAudience } from "./lib/dashboard/dashboard.js";
import { assertPersonalStudentAccess } from "./lib/guardianLinks.js";

const dashboardSeatCurrentValidator = v.object({
  recordedAt: v.number(),
  chartName: v.string(),
  layoutName: v.string(),
  deskNumber: v.optional(v.number()),
  zoneName: v.optional(v.string()),
  teamLabel: v.optional(v.string()),
  neighborDisplayNames: v.array(v.string()),
});

const dashboardAssignerAssignmentValidator = v.object({
  item: v.string(),
  groupName: v.optional(v.string()),
  ranAt: v.number(),
  runId: v.union(v.id("randomAssignerRuns"), v.id("equitableAssignerRuns")),
});

const dashboardAssignerRowValidator = v.object({
  kind: v.union(v.literal("random"), v.literal("equitable")),
  assignerId: v.union(v.id("randomAssigners"), v.id("equitableAssigners")),
  name: v.string(),
  latestRunId: v.union(v.id("randomAssignerRuns"), v.id("equitableAssignerRuns"), v.null()),
  latestRunAt: v.union(v.number(), v.null()),
  assignment: v.union(dashboardAssignerAssignmentValidator, v.null()),
});

const dashboardAssignerSnapshotValidator = v.object({
  seatCurrent: v.union(dashboardSeatCurrentValidator, v.null()),
  assigners: v.array(dashboardAssignerRowValidator),
});

export const assignerSnapshotForAudience = classQuery({
  args: {
    studentUserId: v.id("users"),
  },
  returns: dashboardAssignerSnapshotValidator,
  handler: async (ctx, args) => {
    const classId = ctx.classDoc._id;
    await assertPersonalStudentAccess(ctx, classId, args.studentUserId);
    return await buildAssignerSnapshotForAudience(ctx, classId, args.studentUserId);
  },
});
