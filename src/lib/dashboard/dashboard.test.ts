import { describe, expect, it } from "vite-plus/test";

import {
  DASHBOARD_EVENT_LIMIT,
  DASHBOARD_TASK_LIMIT,
  recentDashboardTasks,
  upcomingDashboardEvents,
} from "./dashboard";
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
});
