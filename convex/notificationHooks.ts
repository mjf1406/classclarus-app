import { vOnNotificationCreatedArgs } from "convex-notification";
import { v } from "convex/values";

import { internal } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import { internalMutation } from "./_generated/server.js";
import {
  pushPayloadFromNotification,
  upsertHistoryFromCreated,
} from "./lib/notifications/history.js";

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
    const push = pushPayloadFromNotification(args.kind, args.data);
    if (push) {
      await ctx.scheduler.runAfter(0, internal.pushActions.sendToUser, {
        userId: args.targetId as Id<"users">,
        title: push.title,
        body: push.body,
        url: push.url,
      });
    }
    return null;
  },
});
