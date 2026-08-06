import { subscriptionsList } from "@polar-sh/sdk/funcs/subscriptionsList.js";
import { unwrapResultIterator } from "@polar-sh/sdk/types/operations.js";
import { v } from "convex/values";

import { components, internal } from "./_generated/api.js";
import { internalAction } from "./_generated/server.js";
import { toPolarComponentSubscription } from "./lib/polarSubscription.js";
import { isSelfHosted } from "./lib/selfHosted.js";
import { polar } from "./polar.js";

/**
 * Pull Polar subscriptions page-by-page and upsert local component rows.
 * Safety net for permanently lost webhook deliveries.
 */
export const reconcileSubscriptions = internalAction({
  args: {
    page: v.optional(v.number()),
    repaired: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (isSelfHosted()) {
      return null;
    }

    const page = args.page ?? 1;
    let repaired = args.repaired ?? 0;
    const limit = 50;

    const response = await unwrapResultIterator(
      subscriptionsList(polar.polar, {
        page,
        limit,
      }),
    );

    const list = response.result;
    for (const subscription of list.items) {
      await ctx.runMutation(components.polar.lib.updateSubscription, {
        subscription: toPolarComponentSubscription(subscription),
      });
      repaired += 1;
    }

    if (page < list.pagination.maxPage) {
      await ctx.scheduler.runAfter(0, internal.polarReconcile.reconcileSubscriptions, {
        page: page + 1,
        repaired,
      });
    } else if (repaired > 0) {
      console.log("Polar subscription reconciliation complete", { repaired });
    }

    return null;
  },
});
