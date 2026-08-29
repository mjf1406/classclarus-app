import { authz } from "../../authz.js";
import { APP_CONFIG } from "../../appConfig.js";
import { components } from "../../_generated/api.js";
import type { Id } from "../../_generated/dataModel.js";
import type { MutationCtx } from "../../_generated/server.js";
import {
  deleteActivityBatchForClass,
  ACTIVITY_PURGE_BATCH_SIZE,
} from "../activity/classActivity.js";
import { CLASS_ROLES, classScope } from "../auth/authzModel.js";
import { deleteAnnouncementsForClass } from "./announcementsCleanup.js";
import { deleteAssignmentsForClass } from "./assignmentsCleanup.js";
import { deleteAttendanceForClass } from "./attendanceCleanup.js";
import { deleteBehaviorsForClass } from "./behaviorsCleanup.js";
import { deleteClassroomScreenForClass } from "./classroomScreenCleanup.js";
import { deleteCalendarForClass } from "./calendarCleanup.js";
import { deleteEquitableAssignersForClass } from "./equitableAssignersCleanup.js";
import { deleteExpectationsForClass } from "./expectationsCleanup.js";
import { deleteFilesBatchForClass } from "./filesCleanupBatch.js";
import { deleteGradeScalesForClass } from "./gradeScalesCleanup.js";
import { deleteGradedSubjectsForClass } from "./gradedSubjectsCleanup.js";
import { deleteGroupsForClass } from "./groupsCleanup.js";
import { deleteJoinCodesForClass } from "./joinCodesCleanup.js";
import { deleteNotificationHistoryBatchForClass } from "./notificationHistoryCleanup.js";
import { deleteWarningEventsForClass } from "./pointsCleanup.js";
import { deleteRandomAssignersForClass } from "./randomAssignersCleanup.js";
import { deleteRazForClass } from "./razCleanup.js";
import { deleteRewardsForClass } from "./rewardsCleanup.js";
import { deleteSeatingBatchForClass } from "./seatingCleanup.js";
import { deleteTasksForClass } from "./tasksCleanup.js";
import { deleteTimetableForClass } from "./timetableCleanup.js";
import { clearLinksForClass } from "../auth/guardianLinks.js";
import {
  deleteClassUserSettingsForClass,
  deleteStudentRostersForClass,
} from "../roster/studentRosters.js";

/** Ordered deletion stages — each must be idempotent. */
export const CLASS_DELETION_STAGES = [
  "joinCodes",
  "guardianLinks",
  "groups",
  "attendance",
  "rosters",
  "announcements",
  "calendar",
  "timetable",
  "classroomScreen",
  "tasks",
  "assignments",
  "expectations",
  "gradedSubjects",
  "randomAssigners",
  "equitableAssigners",
  "gradeScales",
  "behaviors",
  "rewards",
  "warnings",
  "seating",
  "raz",
  "notificationHistory",
  "files",
  "activity",
  "membership",
  "finalize",
] as const;

export type ClassDeletionStage = (typeof CLASS_DELETION_STAGES)[number];

export const CLASS_DELETION_STAGE_COUNT = CLASS_DELETION_STAGES.length;

export function deletionProgressPercent(completedStageCount: number): number {
  return Math.min(100, Math.round((completedStageCount / CLASS_DELETION_STAGE_COUNT) * 100));
}

export function nextDeletionStage(currentStage: string): ClassDeletionStage | null {
  const index = CLASS_DELETION_STAGES.indexOf(currentStage as ClassDeletionStage);
  if (index < 0) {
    return CLASS_DELETION_STAGES[0] ?? null;
  }
  return CLASS_DELETION_STAGES[index + 1] ?? null;
}

export function isValidDeletionStage(stage: string): stage is ClassDeletionStage {
  return (CLASS_DELETION_STAGES as readonly string[]).includes(stage);
}

async function revokeAllClassMembership(ctx: MutationCtx, classId: Id<"classes">): Promise<void> {
  const scope = classScope(classId);
  const userIds = new Set<string>();
  for (const role of CLASS_ROLES) {
    const users = await ctx.runQuery(components.authz.queries.getUsersWithRole, {
      tenantId: APP_CONFIG.authzTenantId,
      role,
      scope,
    });
    for (const user of users) {
      userIds.add(user.userId);
    }
  }
  for (const userId of userIds) {
    await authz.offboardUser(ctx, userId, {
      scope,
      removeOverrides: true,
      removeRelationships: true,
      removeAttributes: false,
    });
  }
}

export type StageRunResult = {
  /** Stage fully finished — advance to the next stage. */
  stageComplete: boolean;
};

/**
 * Run one unit of work for `stage`. Batched stages may require multiple invocations
 * before `stageComplete` is true.
 */
export async function runDeletionStage(
  ctx: MutationCtx,
  classId: Id<"classes">,
  stage: ClassDeletionStage,
): Promise<StageRunResult> {
  switch (stage) {
    case "joinCodes":
      await deleteJoinCodesForClass(ctx, classId);
      return { stageComplete: true };
    case "guardianLinks":
      await clearLinksForClass(ctx, classId);
      return { stageComplete: true };
    case "groups":
      await deleteGroupsForClass(ctx, classId);
      return { stageComplete: true };
    case "attendance":
      await deleteAttendanceForClass(ctx, classId);
      return { stageComplete: true };
    case "rosters":
      await deleteStudentRostersForClass(ctx, classId);
      await deleteClassUserSettingsForClass(ctx, classId);
      return { stageComplete: true };
    case "announcements":
      await deleteAnnouncementsForClass(ctx, classId);
      return { stageComplete: true };
    case "calendar":
      await deleteCalendarForClass(ctx, classId);
      return { stageComplete: true };
    case "timetable":
      await deleteTimetableForClass(ctx, classId);
      return { stageComplete: true };
    case "classroomScreen":
      await deleteClassroomScreenForClass(ctx, classId);
      return { stageComplete: true };
    case "tasks":
      await deleteTasksForClass(ctx, classId);
      return { stageComplete: true };
    case "assignments":
      await deleteAssignmentsForClass(ctx, classId);
      return { stageComplete: true };
    case "expectations":
      await deleteExpectationsForClass(ctx, classId);
      return { stageComplete: true };
    case "gradedSubjects":
      await deleteGradedSubjectsForClass(ctx, classId);
      return { stageComplete: true };
    case "randomAssigners":
      await deleteRandomAssignersForClass(ctx, classId);
      return { stageComplete: true };
    case "equitableAssigners":
      await deleteEquitableAssignersForClass(ctx, classId);
      return { stageComplete: true };
    case "gradeScales":
      await deleteGradeScalesForClass(ctx, classId);
      return { stageComplete: true };
    case "behaviors":
      await deleteBehaviorsForClass(ctx, classId);
      return { stageComplete: true };
    case "rewards":
      await deleteRewardsForClass(ctx, classId);
      return { stageComplete: true };
    case "warnings":
      await deleteWarningEventsForClass(ctx, classId);
      return { stageComplete: true };
    case "seating": {
      const done = await deleteSeatingBatchForClass(ctx, classId);
      return { stageComplete: done };
    }
    case "raz":
      await deleteRazForClass(ctx, classId);
      return { stageComplete: true };
    case "notificationHistory": {
      const done = await deleteNotificationHistoryBatchForClass(ctx, classId);
      return { stageComplete: done };
    }
    case "files": {
      const done = await deleteFilesBatchForClass(ctx, classId);
      return { stageComplete: done };
    }
    case "activity": {
      const deleted = await deleteActivityBatchForClass(ctx, classId);
      return { stageComplete: deleted < ACTIVITY_PURGE_BATCH_SIZE };
    }
    case "membership":
      await revokeAllClassMembership(ctx, classId);
      return { stageComplete: true };
    case "finalize":
      await ctx.db.delete("classes", classId);
      return { stageComplete: true };
    default: {
      const _exhaustive: never = stage;
      throw new Error(`Unknown deletion stage: ${String(_exhaustive)}`);
    }
  }
}
