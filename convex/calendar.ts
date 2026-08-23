import { ConvexError, v } from "convex/values";

import { APP_CONFIG } from "./appConfig.js";
import { components, internal } from "./_generated/api.js";
import type { Doc, Id } from "./_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "./_generated/server.js";
import { internalMutation } from "./_generated/server.js";
import { recordClassActivity } from "./lib/activity/classActivity.js";
import { classScope } from "./lib/auth/authzModel.js";
import { classMutation, classQuery } from "./lib/auth/customFunctions.js";
import { getClassRoleForUser } from "./lib/auth/guardianLinks.js";
import {
  CALENDAR_AUDIENCE_ROLES,
  eventVisibleToRole,
  type CalendarAudienceRole,
} from "./lib/calendar/audience.js";
import {
  CALENDAR_EVENT_MESSAGES_EN,
  normalizeCalendarEventInput,
  type CalendarEventFormValues,
  type NormalizedCalendarEvent,
} from "./lib/calendar/calendarEventSchema.js";
import { eventOverlapsRange } from "./lib/calendar/overlap.js";
import { computeNotifyAt, type ReminderUnit } from "./lib/calendar/reminders.js";
import { isValidTimeZone, startOfZonedDayUtc } from "./lib/calendar/timeZone.js";
import {
  deleteRemindersForEvent,
  dismissNotificationsForEvent,
} from "./lib/cleanup/calendarCleanup.js";
import { notifications } from "./lib/notifications/client.js";
import { rateLimiter } from "./lib/rateLimit/rateLimiter.js";

const reminderUnitValidator = v.union(
  v.literal("minute"),
  v.literal("hour"),
  v.literal("day"),
  v.literal("week"),
);

const reminderInputValidator = v.object({
  amount: v.number(),
  unit: reminderUnitValidator,
  notifyRoles: v.array(v.string()),
});

const reminderDocValidator = v.object({
  _id: v.id("calendarEventReminders"),
  amount: v.number(),
  unit: reminderUnitValidator,
  notifyRoles: v.array(v.string()),
  notifyAt: v.number(),
  status: v.union(
    v.literal("scheduled"),
    v.literal("delivered"),
    v.literal("canceled"),
    v.literal("skipped"),
  ),
});

const calendarEventValidator = v.object({
  _id: v.id("calendarEvents"),
  _creationTime: v.number(),
  classId: v.id("classes"),
  title: v.string(),
  description: v.optional(v.string()),
  allDay: v.boolean(),
  timezone: v.optional(v.string()),
  startAt: v.optional(v.number()),
  endAt: v.optional(v.number()),
  startDateKey: v.optional(v.string()),
  endDateKey: v.optional(v.string()),
  audienceKind: v.union(v.literal("all"), v.literal("roles")),
  audienceRoles: v.array(v.string()),
  createdBy: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
  reminders: v.array(reminderDocValidator),
});

const eventFormArgs = {
  title: v.string(),
  description: v.string(),
  allDay: v.boolean(),
  startDateKey: v.string(),
  startTime: v.string(),
  endDateKey: v.string(),
  endTime: v.string(),
  audienceKind: v.union(v.literal("all"), v.literal("roles")),
  audienceRoles: v.array(v.string()),
  reminders: v.array(reminderInputValidator),
};

function toFormValues(args: {
  title: string;
  description: string;
  allDay: boolean;
  startDateKey: string;
  startTime: string;
  endDateKey: string;
  endTime: string;
  audienceKind: "all" | "roles";
  audienceRoles: Array<string>;
  reminders: Array<{ amount: number; unit: ReminderUnit; notifyRoles: Array<string> }>;
}): CalendarEventFormValues {
  return {
    title: args.title,
    description: args.description,
    allDay: args.allDay,
    startDateKey: args.startDateKey,
    startTime: args.startTime,
    endDateKey: args.endDateKey,
    endTime: args.endTime,
    audienceKind: args.audienceKind,
    audienceRoles: args.audienceRoles as Array<CalendarAudienceRole>,
    reminders: args.reminders.map((reminder) => ({
      amount: reminder.amount,
      unit: reminder.unit,
      notifyRoles: reminder.notifyRoles as Array<CalendarAudienceRole>,
    })),
  };
}

function eventStartMs(event: {
  allDay: boolean;
  startAt?: number;
  startDateKey?: string;
  timezone?: string;
}): number | null {
  if (!event.allDay) {
    return event.startAt ?? null;
  }
  if (!event.startDateKey || !event.timezone || !isValidTimeZone(event.timezone)) {
    return null;
  }
  return startOfZonedDayUtc(event.startDateKey, event.timezone);
}

async function loadRemindersForEvent(
  ctx: QueryCtx | MutationCtx,
  eventId: Id<"calendarEvents">,
): Promise<
  Array<{
    _id: Id<"calendarEventReminders">;
    amount: number;
    unit: ReminderUnit;
    notifyRoles: Array<string>;
    notifyAt: number;
    status: Doc<"calendarEventReminders">["status"];
  }>
> {
  // eslint-disable-next-line @convex-dev/no-collect-in-query -- event-bounded reminders
  const rows = await ctx.db
    .query("calendarEventReminders")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .collect();
  rows.sort((a, b) => a.notifyAt - b.notifyAt);
  return rows.map((row) => ({
    _id: row._id,
    amount: row.amount,
    unit: row.unit,
    notifyRoles: row.notifyRoles,
    notifyAt: row.notifyAt,
    status: row.status,
  }));
}

async function withReminders(ctx: QueryCtx | MutationCtx, event: Doc<"calendarEvents">) {
  return {
    _id: event._id,
    _creationTime: event._creationTime,
    classId: event.classId,
    title: event.title,
    description: event.description,
    allDay: event.allDay,
    timezone: event.timezone,
    startAt: event.startAt,
    endAt: event.endAt,
    startDateKey: event.startDateKey,
    endDateKey: event.endDateKey,
    audienceKind: event.audienceKind,
    audienceRoles: event.audienceRoles,
    createdBy: event.createdBy,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    reminders: await loadRemindersForEvent(ctx, event._id),
  };
}

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

async function replaceEventReminders(
  ctx: MutationCtx,
  classId: Id<"classes">,
  eventId: Id<"calendarEvents">,
  event: NormalizedCalendarEvent,
): Promise<void> {
  await deleteRemindersForEvent(ctx, eventId);
  const startMs = eventStartMs(event);
  if (event.reminders.length > 0 && startMs === null) {
    throw new Error("Set the class time zone before adding reminders");
  }
  if (startMs === null) {
    return;
  }
  const now = Date.now();
  for (const reminder of event.reminders) {
    const notifyAt = computeNotifyAt(startMs, reminder.amount, reminder.unit);
    let status: Doc<"calendarEventReminders">["status"] = "scheduled";
    if (notifyAt <= now && startMs <= now) {
      status = "skipped";
    }
    const reminderId = await ctx.db.insert("calendarEventReminders", {
      classId,
      eventId,
      amount: reminder.amount,
      unit: reminder.unit,
      notifyRoles: reminder.notifyRoles,
      notifyAt,
      revision: 1,
      status,
      createdAt: now,
      updatedAt: now,
    });
    if (status !== "scheduled") {
      continue;
    }
    const delay = Math.max(0, notifyAt - now);
    const scheduledFunctionId = await ctx.scheduler.runAfter(
      delay,
      internal.calendar.deliverReminder,
      { reminderId, revision: 1 },
    );
    await ctx.db.patch("calendarEventReminders", reminderId, { scheduledFunctionId });
  }
}

async function reminderRecipientUserIds(
  ctx: MutationCtx,
  event: Doc<"calendarEvents">,
  notifyRoles: Array<string>,
): Promise<Array<Id<"users">>> {
  const roles =
    notifyRoles.length > 0
      ? notifyRoles
      : event.audienceKind === "roles"
        ? event.audienceRoles
        : [...CALENDAR_AUDIENCE_ROLES];
  const userIds = new Set<string>();
  const scope = classScope(event.classId);
  for (const role of roles) {
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

export const listInRange = classQuery({
  args: {
    rangeStartMs: v.number(),
    rangeEndMs: v.number(),
  },
  returns: v.array(calendarEventValidator),
  handler: async (ctx, args) => {
    await ctx.require("calendar:read");
    if (args.rangeEndMs <= args.rangeStartMs) {
      return [];
    }
    const classId = ctx.classDoc._id;
    const viewerRole = await getClassRoleForUser(ctx, ctx.userId, ctx.scope);
    const timeZone =
      ctx.classDoc.timezone && isValidTimeZone(ctx.classDoc.timezone)
        ? ctx.classDoc.timezone
        : "UTC";
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- classroom-bounded calendar list
    const docs = await ctx.db
      .query("calendarEvents")
      .withIndex("by_classId", (q) => q.eq("classId", classId))
      .collect();
    const visible = docs.filter(
      (event) =>
        eventVisibleToRole(event.audienceKind, event.audienceRoles, viewerRole) &&
        eventOverlapsRange(event, args.rangeStartMs, args.rangeEndMs, timeZone),
    );
    const result = [];
    for (const event of visible) {
      result.push(await withReminders(ctx, event));
    }
    result.sort((a, b) => {
      const aStart = a.startAt ?? 0;
      const bStart = b.startAt ?? 0;
      if (a.allDay !== b.allDay) {
        return a.allDay ? -1 : 1;
      }
      if (a.startDateKey && b.startDateKey && a.startDateKey !== b.startDateKey) {
        return a.startDateKey < b.startDateKey ? -1 : 1;
      }
      return aStart - bStart;
    });
    return result;
  },
});

export const get = classQuery({
  args: {
    eventId: v.id("calendarEvents"),
  },
  returns: v.union(calendarEventValidator, v.null()),
  handler: async (ctx, args) => {
    await ctx.require("calendar:read");
    const event = await ctx.db.get("calendarEvents", args.eventId);
    if (!event || event.classId !== ctx.classDoc._id) {
      return null;
    }
    const viewerRole = await getClassRoleForUser(ctx, ctx.userId, ctx.scope);
    if (!eventVisibleToRole(event.audienceKind, event.audienceRoles, viewerRole)) {
      return null;
    }
    return await withReminders(ctx, event);
  },
});

export const create = classMutation({
  args: eventFormArgs,
  returns: v.id("calendarEvents"),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "calendarEventCreate", { key: ctx.userId, throws: true });
    await ctx.require("calendar:manage");
    const classId = ctx.classDoc._id;
    const normalized = normalizeCalendarEventInput(
      toFormValues(args),
      ctx.classDoc.timezone,
      CALENDAR_EVENT_MESSAGES_EN,
    );
    const now = Date.now();
    const eventId = await ctx.db.insert("calendarEvents", {
      classId,
      title: normalized.title,
      description: normalized.description,
      allDay: normalized.allDay,
      timezone: normalized.timezone,
      startAt: normalized.startAt,
      endAt: normalized.endAt,
      startDateKey: normalized.startDateKey,
      endDateKey: normalized.endDateKey,
      audienceKind: normalized.audienceKind,
      audienceRoles: normalized.audienceRoles,
      createdBy: ctx.userId,
      createdAt: now,
      updatedAt: now,
    });
    await replaceEventReminders(ctx, classId, eventId, normalized);
    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "write",
      resourceType: "calendarEvent",
      resourceId: eventId,
      summary: `Created calendar event "${normalized.title}"`,
      summaryKey: "activitySummary_createdCalendarEvent",
      metadata: { name: normalized.title },
    });
    return eventId;
  },
});

export const update = classMutation({
  args: {
    eventId: v.id("calendarEvents"),
    ...eventFormArgs,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "calendarEventUpdate", { key: ctx.userId, throws: true });
    await ctx.require("calendar:manage");
    const classId = ctx.classDoc._id;
    const existing = await ctx.db.get("calendarEvents", args.eventId);
    if (!existing || existing.classId !== classId) {
      throw new ConvexError({
        code: "CLASS_UNAVAILABLE",
        message: "Class not found or access denied",
      });
    }
    const normalized = normalizeCalendarEventInput(
      toFormValues(args),
      ctx.classDoc.timezone,
      CALENDAR_EVENT_MESSAGES_EN,
    );
    await ctx.db.patch("calendarEvents", args.eventId, {
      title: normalized.title,
      description: normalized.description,
      allDay: normalized.allDay,
      timezone: normalized.timezone,
      startAt: normalized.startAt,
      endAt: normalized.endAt,
      startDateKey: normalized.startDateKey,
      endDateKey: normalized.endDateKey,
      audienceKind: normalized.audienceKind,
      audienceRoles: normalized.audienceRoles,
      updatedAt: Date.now(),
    });
    await replaceEventReminders(ctx, classId, args.eventId, normalized);
    await recordClassActivity(ctx, {
      classId,
      actorUserId: ctx.userId,
      action: "update",
      resourceType: "calendarEvent",
      resourceId: args.eventId,
      summary: `Updated calendar event "${normalized.title}"`,
      summaryKey: "activitySummary_updatedCalendarEvent",
      metadata: { name: normalized.title },
    });
    return null;
  },
});

export const remove = classMutation({
  args: {
    eventId: v.id("calendarEvents"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "calendarEventRemove", { key: ctx.userId, throws: true });
    await ctx.require("calendar:manage");
    const existing = await ctx.db.get("calendarEvents", args.eventId);
    if (!existing || existing.classId !== ctx.classDoc._id) {
      throw new ConvexError({
        code: "CLASS_UNAVAILABLE",
        message: "Class not found or access denied",
      });
    }
    // eslint-disable-next-line @convex-dev/no-collect-in-query -- event-bounded reminder cleanup
    const reminders = await ctx.db
      .query("calendarEventReminders")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect();
    await dismissNotificationsForEvent(
      ctx,
      args.eventId,
      reminders.map((reminder) => reminder._id),
    );
    await deleteRemindersForEvent(ctx, args.eventId);
    await ctx.db.delete("calendarEvents", args.eventId);
    await recordClassActivity(ctx, {
      classId: ctx.classDoc._id,
      actorUserId: ctx.userId,
      action: "delete",
      resourceType: "calendarEvent",
      resourceId: args.eventId,
      summary: `Deleted calendar event "${existing.title}"`,
      summaryKey: "activitySummary_deletedCalendarEvent",
      metadata: { name: existing.title },
    });
    return null;
  },
});

export const deliverReminder = internalMutation({
  args: {
    reminderId: v.id("calendarEventReminders"),
    revision: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reminder = await ctx.db.get("calendarEventReminders", args.reminderId);
    if (!reminder || reminder.revision !== args.revision || reminder.status !== "scheduled") {
      return null;
    }
    const event = await ctx.db.get("calendarEvents", reminder.eventId);
    if (!event) {
      await cancelReminderJob(ctx, reminder.scheduledFunctionId);
      await ctx.db.patch("calendarEventReminders", reminder._id, {
        status: "skipped",
        updatedAt: Date.now(),
      });
      return null;
    }
    const classDoc = await ctx.db.get("classes", event.classId);
    const className = classDoc?.name ?? "";
    const href = `/class/${event.classId}/calendar?event=${event._id}`;
    const recipients = await reminderRecipientUserIds(ctx, event, reminder.notifyRoles);
    for (const userId of recipients) {
      await notifications.createIdempotent(ctx, {
        targetId: userId,
        kind: "calendar_reminder",
        data: {
          summaryKey: "calendarReminder",
          title: event.title,
          ...(event.description ? { description: event.description } : {}),
          classId: event.classId,
          className,
          eventId: event._id,
          href,
        },
        source: { type: "calendar_event", id: event._id },
        dedupeKey: `calendar-reminder:${reminder._id}:${userId}`,
      });
      await ctx.scheduler.runAfter(0, internal.pushActions.sendToUser, {
        userId,
        title: event.title,
        body: event.description?.trim() || className,
        url: href,
      });
    }
    await ctx.db.patch("calendarEventReminders", reminder._id, {
      status: "delivered",
      updatedAt: Date.now(),
    });
    return null;
  },
});
