import { describe, expect, it } from "vite-plus/test";

import {
  DASHBOARD_ASSIGNMENT_LIMIT,
  DASHBOARD_EVENT_LIMIT,
  DASHBOARD_TASK_LIMIT,
  dashboardAssignmentCounts,
  recentDashboardTasks,
  upcomingDashboardAssignments,
  upcomingDashboardEvents,
} from "./dashboard";
import type { AssignmentListItem } from "@/lib/assignments/assignments";
import type { CalendarEvent } from "@/lib/calendar/calendar";
import type { TaskListItem } from "@/lib/tasks/tasks";

function calendarEvent(
  partial: Partial<CalendarEvent> & Pick<CalendarEvent, "_id">,
): CalendarEvent {
  return {
    _creationTime: 1,
    classId: "class" as CalendarEvent["classId"],
    title: partial.title ?? "Event",
    description: partial.description,
    allDay: partial.allDay ?? false,
    timezone: partial.timezone,
    startAt: partial.startAt,
    endAt: partial.endAt,
    startDateKey: partial.startDateKey,
    endDateKey: partial.endDateKey,
    audienceKind: partial.audienceKind ?? "all",
    audienceRoles: partial.audienceRoles ?? [],
    attachmentFileIds: partial.attachmentFileIds ?? [],
    createdBy: "user" as CalendarEvent["createdBy"],
    updatedAt: partial.updatedAt ?? 1,
    reminders: partial.reminders ?? [],
    ...partial,
  } as CalendarEvent;
}

function taskItem(partial: Partial<TaskListItem> & Pick<TaskListItem, "_id">): TaskListItem {
  return {
    _creationTime: 1,
    classId: "class" as TaskListItem["classId"],
    name: partial.name ?? "Task",
    createdAt: partial.createdAt ?? 1,
    updatedAt: partial.updatedAt ?? 1,
    completedStudentIds: partial.completedStudentIds ?? [],
    createdBy: partial.createdBy ?? ("user" as TaskListItem["createdBy"]),
    completedCount: partial.completedCount ?? 0,
    ...partial,
  } as TaskListItem;
}

describe("dashboard helpers", () => {
  it("returns the next upcoming events in order", () => {
    const nowMs = Date.parse("2026-03-01T12:00:00.000Z");
    const events = [
      calendarEvent({
        _id: "later" as CalendarEvent["_id"],
        title: "Later",
        startAt: Date.parse("2026-03-05T12:00:00.000Z"),
        endAt: Date.parse("2026-03-05T13:00:00.000Z"),
      }),
      calendarEvent({
        _id: "soon" as CalendarEvent["_id"],
        title: "Soon",
        startAt: Date.parse("2026-03-02T12:00:00.000Z"),
        endAt: Date.parse("2026-03-02T13:00:00.000Z"),
      }),
      calendarEvent({
        _id: "past" as CalendarEvent["_id"],
        title: "Past",
        startAt: Date.parse("2026-02-20T12:00:00.000Z"),
        endAt: Date.parse("2026-02-20T13:00:00.000Z"),
      }),
    ];

    const result = upcomingDashboardEvents(events, nowMs, "UTC", DASHBOARD_EVENT_LIMIT);
    expect(result.map((event) => event._id)).toEqual([
      "soon" as CalendarEvent["_id"],
      "later" as CalendarEvent["_id"],
    ]);
  });

  it("returns the most recently updated active tasks", () => {
    const tasks = [
      taskItem({ _id: "old" as TaskListItem["_id"], updatedAt: 100 }),
      taskItem({ _id: "new" as TaskListItem["_id"], updatedAt: 300 }),
      taskItem({
        _id: "archived" as TaskListItem["_id"],
        updatedAt: 500,
        archivedAt: 400,
      }),
    ];

    const result = recentDashboardTasks(tasks, DASHBOARD_TASK_LIMIT);
    expect(result.map((task) => task._id)).toEqual([
      "new" as TaskListItem["_id"],
      "old" as TaskListItem["_id"],
    ]);
  });

  it("orders dated assignments soonest first, then undated by update time", () => {
    const now = new Date(2026, 2, 15, 12, 0, 0);
    const assignments = [
      assignmentItem({
        _id: "later" as AssignmentListItem["_id"],
        dueDateKey: "2026-03-20",
        updatedAt: 500,
      }),
      assignmentItem({
        _id: "undated-old" as AssignmentListItem["_id"],
        updatedAt: 100,
      }),
      assignmentItem({
        _id: "overdue" as AssignmentListItem["_id"],
        dueDateKey: "2026-03-10",
        updatedAt: 200,
      }),
      assignmentItem({
        _id: "undated-new" as AssignmentListItem["_id"],
        updatedAt: 400,
      }),
      assignmentItem({
        _id: "soon" as AssignmentListItem["_id"],
        dueDateKey: "2026-03-16",
        updatedAt: 50,
      }),
    ];

    const result = upcomingDashboardAssignments(assignments, now, DASHBOARD_ASSIGNMENT_LIMIT);
    expect(result.map((assignment) => assignment._id)).toEqual([
      "overdue" as AssignmentListItem["_id"],
      "soon" as AssignmentListItem["_id"],
      "later" as AssignmentListItem["_id"],
      "undated-new" as AssignmentListItem["_id"],
      "undated-old" as AssignmentListItem["_id"],
    ]);
  });

  it("drops assignments overdue beyond the 14-day window", () => {
    const now = new Date(2026, 2, 15, 12, 0, 0);
    const assignments = [
      assignmentItem({
        _id: "too-old" as AssignmentListItem["_id"],
        dueDateKey: "2026-02-28",
      }),
      assignmentItem({
        _id: "edge" as AssignmentListItem["_id"],
        dueDateKey: "2026-03-01",
      }),
      assignmentItem({
        _id: "undated" as AssignmentListItem["_id"],
      }),
    ];

    const result = upcomingDashboardAssignments(assignments, now);
    expect(result.map((assignment) => assignment._id)).toEqual([
      "edge" as AssignmentListItem["_id"],
      "undated" as AssignmentListItem["_id"],
    ]);
  });

  it("limits upcoming assignments", () => {
    const now = new Date(2026, 2, 15, 12, 0, 0);
    const assignments = [
      assignmentItem({ _id: "a" as AssignmentListItem["_id"], dueDateKey: "2026-03-16" }),
      assignmentItem({ _id: "b" as AssignmentListItem["_id"], dueDateKey: "2026-03-17" }),
      assignmentItem({ _id: "c" as AssignmentListItem["_id"], dueDateKey: "2026-03-18" }),
    ];

    const result = upcomingDashboardAssignments(assignments, now, 2);
    expect(result.map((assignment) => assignment._id)).toEqual([
      "a" as AssignmentListItem["_id"],
      "b" as AssignmentListItem["_id"],
    ]);
  });

  it("counts assignments due this week and overdue not handed in", () => {
    const now = new Date(2026, 2, 15, 12, 0, 0);
    const studentUserId = "stu-1";
    const assignments = [
      assignmentItem({
        _id: "due-this-week" as AssignmentListItem["_id"],
        dueDateKey: "2026-03-18",
        acceptLinkSubmissions: true,
      }),
      assignmentItem({
        _id: "due-next-week" as AssignmentListItem["_id"],
        dueDateKey: "2026-03-25",
      }),
      assignmentItem({
        _id: "overdue-not-handed" as AssignmentListItem["_id"],
        dueDateKey: "2026-03-10",
        acceptLinkSubmissions: true,
        handedInStudentIds: [],
      }),
      assignmentItem({
        _id: "overdue-handed" as AssignmentListItem["_id"],
        dueDateKey: "2026-03-10",
        acceptLinkSubmissions: true,
        handedInStudentIds: [studentUserId as AssignmentListItem["handedInStudentIds"][number]],
        handedInStudentCount: 1,
      }),
      assignmentItem({
        _id: "overdue-no-links" as AssignmentListItem["_id"],
        dueDateKey: "2026-03-10",
        acceptLinkSubmissions: false,
      }),
      assignmentItem({
        _id: "undated" as AssignmentListItem["_id"],
      }),
    ];

    expect(dashboardAssignmentCounts(assignments, studentUserId, now)).toEqual({
      dueThisWeek: 1,
      notHandedIn: 1,
    });
  });
});

function assignmentItem(
  partial: Partial<AssignmentListItem> & Pick<AssignmentListItem, "_id">,
): AssignmentListItem {
  return {
    _creationTime: 1,
    classId: "class" as AssignmentListItem["classId"],
    name: partial.name ?? "Assignment",
    scoringMode: "total",
    procedureSteps: [],
    expectationIds: [],
    acceptLinkSubmissions: partial.acceptLinkSubmissions ?? false,
    scoresReleased: false,
    createdBy: "user" as AssignmentListItem["createdBy"],
    createdAt: 1,
    updatedAt: partial.updatedAt ?? 1,
    handedInStudentCount: partial.handedInStudentCount ?? 0,
    handedInStudentIds: partial.handedInStudentIds ?? [],
    studentCount: 1,
    linkCount: 0,
    hasInstructions: false,
    hasProcedure: false,
    ...partial,
  } as AssignmentListItem;
}
