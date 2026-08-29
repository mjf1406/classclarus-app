import { addDaysToDateKey } from "../../../convex/lib/calendar/dateKey";
import { classNowDateKey } from "../../../convex/lib/calendar/monthGrid";
import type { CalendarEvent } from "@/lib/calendar/calendar";
import { eventSortKey } from "@/lib/calendar/calendar";
import type { TaskListItem } from "@/lib/tasks/tasks";
import { isTaskArchived } from "@/lib/tasks/tasks";

export const DASHBOARD_EVENT_LIMIT = 5;
export const DASHBOARD_TASK_LIMIT = 5;
export const DASHBOARD_EVENT_LOOKAHEAD_DAYS = 90;

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
