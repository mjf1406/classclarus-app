import { addDaysToDateKey } from "../../../convex/lib/calendar/dateKey";
import { classNowDateKey } from "../../../convex/lib/calendar/monthGrid";
import {
  isStudentAssignmentHandedIn,
  type AssignmentListItem,
} from "@/lib/assignments/assignments";
import type { CalendarEvent } from "@/lib/calendar/calendar";
import { eventSortKey } from "@/lib/calendar/calendar";
import { dueDateKeyHasTime, isPastDue, parseDueDateKey } from "@/lib/dueDate/dueDateKey";
import { localDateKey } from "@/lib/attendance/dateKey";
import type { TaskListItem } from "@/lib/tasks/tasks";
import { isTaskArchived } from "@/lib/tasks/tasks";

export const DASHBOARD_EVENT_LIMIT = 5;
export const DASHBOARD_TASK_LIMIT = 5;
export const DASHBOARD_ASSIGNMENT_LIMIT = 5;
export const DASHBOARD_ASSIGNMENT_OVERDUE_DAYS = 14;
export const DASHBOARD_ASSIGNMENT_WEEK_DAYS = 7;
export const DASHBOARD_EVENT_LOOKAHEAD_DAYS = 90;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function upcomingDashboardEvents(
  events: readonly CalendarEvent[],
  nowMs: number,
  timeZone: string,
  limit = DASHBOARD_EVENT_LIMIT,
): CalendarEvent[] {
  const todayKey = classNowDateKey(nowMs, timeZone);
  const upcoming = events.filter((event) => {
    if (event.allDay) {
      const startKey = event.startDateKey ?? todayKey;
      const endExclusive = event.endDateKey ?? addDaysToDateKey(startKey, 1);
      return endExclusive > todayKey;
    }
    const endAt = event.endAt ?? event.startAt ?? 0;
    return endAt >= nowMs;
  });

  return [...upcoming]
    .sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)))
    .slice(0, limit);
}

export function recentDashboardTasks(
  tasks: readonly TaskListItem[],
  limit = DASHBOARD_TASK_LIMIT,
): TaskListItem[] {
  return [...tasks]
    .filter((task) => !isTaskArchived(task))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

export function dashboardEventRange(nowMs: number, lookaheadDays = DASHBOARD_EVENT_LOOKAHEAD_DAYS) {
  const rangeStartMs = nowMs;
  const rangeEndMs = nowMs + lookaheadDays * 24 * 60 * 60 * 1000;
  return { rangeStartMs, rangeEndMs };
}

function isAssignmentInDashboardWindow(
  dueDateKey: string | undefined,
  now: Date,
  overdueDays: number,
): boolean {
  if (!dueDateKey) return true;
  if (!dueDateKeyHasTime(dueDateKey)) {
    const cutoff = addDaysToDateKey(localDateKey(now), -overdueDays);
    return dueDateKey >= cutoff;
  }
  const due = parseDueDateKey(dueDateKey);
  if (!due) return true;
  return due.getTime() >= now.getTime() - overdueDays * MS_PER_DAY;
}

function isAssignmentDueThisWeek(dueDateKey: string | undefined, now: Date): boolean {
  if (!dueDateKey || isPastDue(dueDateKey, now)) return false;
  if (!dueDateKeyHasTime(dueDateKey)) {
    const weekEnd = addDaysToDateKey(localDateKey(now), DASHBOARD_ASSIGNMENT_WEEK_DAYS - 1);
    return dueDateKey <= weekEnd;
  }
  const due = parseDueDateKey(dueDateKey);
  if (!due) return false;
  return due.getTime() < now.getTime() + DASHBOARD_ASSIGNMENT_WEEK_DAYS * MS_PER_DAY;
}

export function upcomingDashboardAssignments(
  assignments: readonly AssignmentListItem[],
  now: Date = new Date(),
  limit = DASHBOARD_ASSIGNMENT_LIMIT,
): AssignmentListItem[] {
  const dated: AssignmentListItem[] = [];
  const undated: AssignmentListItem[] = [];

  for (const assignment of assignments) {
    if (
      !isAssignmentInDashboardWindow(assignment.dueDateKey, now, DASHBOARD_ASSIGNMENT_OVERDUE_DAYS)
    ) {
      continue;
    }
    if (assignment.dueDateKey) {
      dated.push(assignment);
    } else {
      undated.push(assignment);
    }
  }

  dated.sort((a, b) => (a.dueDateKey ?? "").localeCompare(b.dueDateKey ?? ""));
  undated.sort((a, b) => b.updatedAt - a.updatedAt);

  return [...dated, ...undated].slice(0, limit);
}

export function dashboardAssignmentCounts(
  assignments: readonly AssignmentListItem[],
  studentUserId: string,
  now: Date = new Date(),
): { dueThisWeek: number; notHandedIn: number } {
  let dueThisWeek = 0;
  let notHandedIn = 0;

  for (const assignment of assignments) {
    if (isAssignmentDueThisWeek(assignment.dueDateKey, now)) {
      dueThisWeek += 1;
    }
    if (
      assignment.acceptLinkSubmissions &&
      isPastDue(assignment.dueDateKey, now) &&
      !isStudentAssignmentHandedIn(assignment, studentUserId)
    ) {
      notHandedIn += 1;
    }
  }

  return { dueThisWeek, notHandedIn };
}
