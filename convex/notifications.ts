import { getAuthUserId } from "@convex-dev/auth/server";
import { makeNotificationAPI } from "convex-notification/server";

import { notifications } from "./lib/notifications/client.js";

const userNotifications = makeNotificationAPI(notifications, {
  resolveTargetId: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }
    return userId;
  },
});

export const { list, listPage, counts, unseenCount, markSeen, markAllSeen, dismiss, dismissAll } =
  userNotifications;
