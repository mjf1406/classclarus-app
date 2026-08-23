import { vOnNotificationCreatedArgs } from "convex-notification";
import { v } from "convex/values";

import { internalMutation } from "./_generated/server.js";
import { upsertHistoryFromCreated } from "./lib/notifications/history.js";

export const onNotificationCreated = internalMutation({
  args: vOnNotificationCreatedArgs.fields,
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertHistoryFromCreated(ctx, {
      notificationId: args.notificationId,
      targetId: args.targetId,
      kind: args.kind,
      data: args.data,
      createdAt: args.createdAt,
    });
    return null;
  },
});
