import { v } from "convex/values";
import { defineNotifications } from "convex-notification";

import { components, internal } from "../../_generated/api.js";

export const calendarReminderDataValidator = v.object({
  summaryKey: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
  classId: v.string(),
  className: v.string(),
  eventId: v.string(),
  href: v.string(),
});

export const notifications = defineNotifications(components.notification, {
  defaultListLimit: 50,
  batchChunkSize: 100,
  kinds: {
    calendar_reminder: calendarReminderDataValidator,
  },
}).withHooks({
  onNotificationCreated: internal.notificationHooks.onNotificationCreated,
});
