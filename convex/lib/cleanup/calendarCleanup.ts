import type { Id } from "../../_generated/dataModel.js";
import type { MutationCtx } from "../../_generated/server.js";
import { markHistoryDismissedByEventId } from "../notifications/history.js";
import { notifications } from "../notifications/client.js";

async function cancelReminderJob(
  ctx: MutationCtx,
  jobId: Id<"_scheduled_functions"> | undefined,
): Promise<void> {
  if (!jobId) return;
  try {
    await ctx.scheduler.cancel(jobId);
  } catch {
    // Job may already have run or been canceled.
  }
}

/** Hide inbox rows for this event (new calendar_event source and legacy reminder source). */
export async function dismissNotificationsForEvent(
  ctx: MutationCtx,
  eventId: Id<"calendarEvents">,
  reminderIds: Array<Id<"calendarEventReminders">>,
): Promise<void> {
  await notifications.dismissBySource(ctx, {
    source: { type: "calendar_event", id: eventId },
  });
  for (const reminderId of reminderIds) {
    await notifications.dismissBySource(ctx, {
      source: { type: "calendar_reminder", id: reminderId },
    });
  }
  await markHistoryDismissedByEventId(ctx, eventId, Date.now());
}

export async function deleteRemindersForEvent(
  ctx: MutationCtx,
  eventId: Id<"calendarEvents">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- event-bounded reminder cleanup
  const reminders = await ctx.db
    .query("calendarEventReminders")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .collect();
  for (const reminder of reminders) {
    await cancelReminderJob(ctx, reminder.scheduledFunctionId);
    await ctx.db.delete("calendarEventReminders", reminder._id);
  }
}

/** Cascade-delete calendar events, reminder jobs, and reminder inbox items for a class. */
export async function deleteCalendarForClass(
  ctx: MutationCtx,
  classId: Id<"classes">,
): Promise<void> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const reminders = await ctx.db
    .query("calendarEventReminders")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  const reminderIdsByEvent = new Map<Id<"calendarEvents">, Array<Id<"calendarEventReminders">>>();
  for (const reminder of reminders) {
    const ids = reminderIdsByEvent.get(reminder.eventId) ?? [];
    ids.push(reminder._id);
    reminderIdsByEvent.set(reminder.eventId, ids);
  }

  // eslint-disable-next-line @convex-dev/no-collect-in-query -- class delete cleanup, classroom-bounded
  const events = await ctx.db
    .query("calendarEvents")
    .withIndex("by_classId", (q) => q.eq("classId", classId))
    .collect();
  for (const event of events) {
    await dismissNotificationsForEvent(ctx, event._id, reminderIdsByEvent.get(event._id) ?? []);
  }

  for (const reminder of reminders) {
    await cancelReminderJob(ctx, reminder.scheduledFunctionId);
    await ctx.db.delete("calendarEventReminders", reminder._id);
  }

  for (const event of events) {
    await ctx.db.delete("calendarEvents", event._id);
  }
}
