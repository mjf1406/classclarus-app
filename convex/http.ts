import type { WebhookEventHandlers } from "@convex-dev/polar";
import { httpRouter } from "convex/server";

import { components } from "./_generated/api.js";
import { auth } from "./auth";
import { toPolarComponentSubscription } from "./lib/polarSubscription.js";
import { polar } from "./polar";

const http = httpRouter();

auth.addHttpRoutes(http);

async function logAndPersistSubscription(
  ctx: {
    runMutation: (
      ref: typeof components.polar.lib.updateSubscription,
      args: { subscription: ReturnType<typeof toPolarComponentSubscription> },
    ) => Promise<unknown>;
  },
  eventType: string,
  data: Parameters<typeof toPolarComponentSubscription>[0],
) {
  console.log("Polar subscription lifecycle event", {
    type: eventType,
    subscriptionId: data.id,
    status: data.status,
    customerId: data.customerId,
  });
  await ctx.runMutation(components.polar.lib.updateSubscription, {
    subscription: toPolarComponentSubscription(data),
  });
}

const subscriptionLifecycleEvents = {
  "subscription.canceled": async (ctx, event) => {
    await logAndPersistSubscription(ctx, event.type, event.data);
  },
  "subscription.revoked": async (ctx, event) => {
    await logAndPersistSubscription(ctx, event.type, event.data);
  },
  "subscription.past_due": async (ctx, event) => {
    await logAndPersistSubscription(ctx, event.type, event.data);
  },
  "subscription.uncanceled": async (ctx, event) => {
    await logAndPersistSubscription(ctx, event.type, event.data);
  },
} satisfies WebhookEventHandlers;

polar.registerRoutes(http, {
  events: subscriptionLifecycleEvents,
});

export default http;
