"use node";

import { v } from "convex/values";
import webpush from "web-push";

import { internal } from "./_generated/api.js";
import { internalAction } from "./_generated/server.js";

function vapidConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:support@classclarus.com";
  if (!publicKey || !privateKey) {
    return null;
  }
  return { publicKey, privateKey, subject };
}

export const sendToUser = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    url: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const vapid = vapidConfig();
    if (!vapid) {
      return null;
    }
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

    const subscriptions = await ctx.runQuery(internal.pushInternal.listForUser, {
      userId: args.userId,
    });
    const payload = JSON.stringify({
      title: args.title,
      body: args.body,
      url: args.url,
    });

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
        );
      } catch (error) {
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? Number((error as { statusCode?: unknown }).statusCode)
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          await ctx.runMutation(internal.pushInternal.removeByEndpoint, {
            endpoint: subscription.endpoint,
          });
        } else {
          console.error("Web Push delivery failed", {
            userId: args.userId,
            statusCode,
          });
        }
      }
    }
    return null;
  },
});
