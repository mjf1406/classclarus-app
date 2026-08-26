import { APP_CONFIG } from "../../appConfig.js";
import { components } from "../../_generated/api.js";
import type { Doc, Id } from "../../_generated/dataModel.js";
import type { MutationCtx } from "../../_generated/server.js";
import { classScope } from "../authzModel.js";
import { notifications } from "../notifications/client.js";
import { formatRosterNameParts, resolveRosterNameFormat } from "../roster/rosterNameFormat.js";
import { ledgerQuantity } from "./pointsRoster.js";
import {
  crossedPointsBadgeAlerts,
  pointsBadgeAlertEnglishTitle,
  pointsBoardHref,
  resolvePointsBadgeAlerts,
  type PointsBadgeAlertMetric,
} from "./pointsBadgeAlert.js";
import {
  isTimestampInPointsBadgeWindow,
  pointsBadgeLookbackForTimeZone,
  resolvePointsBadgeWindow,
} from "./pointsBadgeWindow.js";

const STAFF_ROLES = ["owner", "teacher", "assistant_teacher"] as const;

async function listStaffUserIds(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<Array<Id<"users">>> {
  const userIds = new Set<string>();
  const scope = classScope(classId);
  for (const role of STAFF_ROLES) {
    const users = await ctx.runQuery(components.authz.queries.getUsersWithRole, {
      tenantId: APP_CONFIG.authzTenantId,
      role,
      scope,
    });
    for (const entry of users) {
      userIds.add(entry.userId);
    }
  }
  return [...userIds] as Array<Id<"users">>;
}

async function studentDisplayName(
  ctx: MutationCtx,
  classDoc: Doc<"classes">,
  studentUserId: Id<"users">,
): Promise<string> {
  const roster = await ctx.db
    .query("studentRosters")
    .withIndex("by_classId_userId", (q) =>
      q.eq("classId", classDoc._id).eq("userId", studentUserId),
    )
    .unique();
  const format = resolveRosterNameFormat({
    rosterNameOrder: classDoc.rosterNameOrder,
    rosterNameSpace: classDoc.rosterNameSpace,
  });
  const rosterName = formatRosterNameParts(roster?.firstName, roster?.lastName, format);
  if (rosterName) return rosterName;
  const user = await ctx.db.get("users", studentUserId);
  const name = user?.name?.trim();
  if (name) return name;
  const email = user?.email?.trim();
  if (email) return email;
  return "Student";
}

async function countWarningsInWindow(
  ctx: MutationCtx,
  classId: Id<"classes">,
  studentUserId: Id<"users">,
  startMs: number,
  endMs: number,
): Promise<number> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- student-scoped lookback
  const events = await ctx.db
    .query("studentWarningEvents")
    .withIndex("by_classId_student_createdAt", (q) =>
      q
        .eq("classId", classId)
        .eq("studentUserId", studentUserId)
        .gte("createdAt", startMs)
        .lt("createdAt", endMs),
    )
    .collect();
  return events.length;
}

async function countMinusesInWindow(
  ctx: MutationCtx,
  classId: Id<"classes">,
  studentUserId: Id<"users">,
  startMs: number,
  endMs: number,
): Promise<number> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- student-scoped lookback
  const applications = await ctx.db
    .query("behaviorApplications")
    .withIndex("by_classId_student_awardedAt", (q) =>
      q
        .eq("classId", classId)
        .eq("studentUserId", studentUserId)
        .gte("awardedAt", startMs)
        .lt("awardedAt", endMs),
    )
    .collect();
  let total = 0;
  for (const app of applications) {
    if (app.pointsApplied >= 0) continue;
    if (!isTimestampInPointsBadgeWindow(app.awardedAt, { startMs, endMs })) continue;
    total += ledgerQuantity(app.quantity);
  }
  return total;
}

export async function countStudentWarningsInBadgeWindow(
  ctx: MutationCtx,
  classDoc: Doc<"classes">,
  studentUserId: Id<"users">,
  now: number,
): Promise<number> {
  const window = pointsBadgeLookbackForTimeZone(
    now,
    classDoc.timezone,
    resolvePointsBadgeWindow(classDoc.warningWindowAmount, classDoc.warningWindowUnit),
  );
  return await countWarningsInWindow(
    ctx,
    classDoc._id,
    studentUserId,
    window.startMs,
    window.endMs,
  );
}

export async function countStudentMinusesInBadgeWindow(
  ctx: MutationCtx,
  classDoc: Doc<"classes">,
  studentUserId: Id<"users">,
  now: number,
): Promise<number> {
  const window = pointsBadgeLookbackForTimeZone(
    now,
    classDoc.timezone,
    resolvePointsBadgeWindow(classDoc.minusWindowAmount, classDoc.minusWindowUnit),
  );
  return await countMinusesInWindow(ctx, classDoc._id, studentUserId, window.startMs, window.endMs);
}

export async function maybeNotifyPointsBadgeAlert(
  ctx: MutationCtx,
  args: {
    classDoc: Doc<"classes">;
    studentUserId: Id<"users">;
    metric: PointsBadgeAlertMetric;
    previousCount: number;
    newCount: number;
    now: number;
  },
): Promise<void> {
  const alerts = resolvePointsBadgeAlerts(
    args.metric === "warning" ? args.classDoc.warningAlerts : args.classDoc.minusAlerts,
  );
  const crossed = crossedPointsBadgeAlerts(args.previousCount, args.newCount, alerts);
  if (crossed.length === 0) return;

  const recipients = await listStaffUserIds(ctx, args.classDoc._id);
  if (recipients.length === 0) return;

  const studentName = await studentDisplayName(ctx, args.classDoc, args.studentUserId);
  const href = pointsBoardHref(args.classDoc._id);
  const lookback = pointsBadgeLookbackForTimeZone(
    args.now,
    args.classDoc.timezone,
    resolvePointsBadgeWindow(
      args.metric === "warning"
        ? args.classDoc.warningWindowAmount
        : args.classDoc.minusWindowAmount,
      args.metric === "warning" ? args.classDoc.warningWindowUnit : args.classDoc.minusWindowUnit,
    ),
  );

  for (const alert of crossed) {
    const title = pointsBadgeAlertEnglishTitle(studentName, args.metric, alert.count);
    await notifications.enqueueBatch(ctx, {
      targetIds: recipients,
      kind: "points_badge_alert",
      data: {
        summaryKey: "pointsBadgeAlert",
        title,
        classId: args.classDoc._id,
        className: args.classDoc.name,
        studentUserId: args.studentUserId,
        studentName,
        metric: args.metric,
        count: alert.count,
        threshold: alert.count,
        action: alert.action,
        href,
      },
      source: {
        type: "points_badge_alert",
        id: `${args.classDoc._id}:${args.studentUserId}:${args.metric}:${alert.count}:${lookback.startMs}`,
      },
      dedupeKeyPrefix: `points-badge-alert:${args.classDoc._id}:${args.studentUserId}:${args.metric}:${alert.count}:${lookback.startMs}`,
    });
  }
}
