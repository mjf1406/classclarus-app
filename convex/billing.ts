import { type Infer, v } from "convex/values";

import { polar } from "./polar.js";
import { authedMutation, authedQuery } from "./lib/customFunctions.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import { isSelfHosted } from "./lib/selfHosted.js";
import { claimTrialGrant } from "./lib/trial.js";

const subscriptionSummaryValidator = v.object({
  status: v.string(),
  productKey: v.union(v.string(), v.null()),
  productName: v.union(v.string(), v.null()),
  amount: v.union(v.number(), v.null()),
  currency: v.union(v.string(), v.null()),
  recurringInterval: v.union(v.string(), v.null()),
  currentPeriodStart: v.union(v.string(), v.null()),
  currentPeriodEnd: v.union(v.string(), v.null()),
  startedAt: v.union(v.string(), v.null()),
  cancelAtPeriodEnd: v.boolean(),
  canceledAt: v.union(v.string(), v.null()),
  endsAt: v.union(v.string(), v.null()),
});

const entitlementValidator = v.object({
  trialEndsAt: v.union(v.number(), v.null()),
  subscriptionStatus: v.union(v.string(), v.null()),
  currentPeriodEnd: v.union(v.string(), v.null()),
  productKey: v.union(v.string(), v.null()),
  subscription: v.union(subscriptionSummaryValidator, v.null()),
});

type Entitlement = Infer<typeof entitlementValidator>;

/**
 * Raw entitlement fields for the current user.
 * Status is derived client-side (queries must not call `Date.now()`).
 */
export const getEntitlement = authedQuery({
  args: {},
  returns: entitlementValidator,
  handler: async (ctx): Promise<Entitlement> => {
    if (isSelfHosted()) {
      return {
        trialEndsAt: null,
        subscriptionStatus: "active",
        currentPeriodEnd: null,
        productKey: "selfHosted",
        subscription: null,
      };
    }

    const grant = await ctx.db
      .query("trialGrants")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.userId))
      .first();

    // Annotated to break polar ↔ api ↔ billing circular inference.
    const subscription: Awaited<ReturnType<typeof polar.getCurrentSubscription>> =
      await polar.getCurrentSubscription(ctx, {
        userId: ctx.userId,
      });

    const summary = subscription
      ? {
          status: subscription.status,
          productKey:
            subscription.productKey !== undefined ? String(subscription.productKey) : null,
          productName: subscription.product?.name ?? null,
          amount: subscription.amount ?? null,
          currency: subscription.currency ?? null,
          recurringInterval: subscription.recurringInterval ?? null,
          currentPeriodStart: subscription.currentPeriodStart ?? null,
          currentPeriodEnd: subscription.currentPeriodEnd ?? null,
          startedAt: subscription.startedAt ?? null,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          canceledAt: subscription.canceledAt ?? null,
          endsAt: subscription.endsAt ?? null,
        }
      : null;

    return {
      trialEndsAt: grant?.endsAt ?? null,
      subscriptionStatus: subscription?.status ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
      productKey: summary?.productKey ?? null,
      subscription: summary,
    };
  },
});

/**
 * Lazily claim the card-less trial for existing sessions that predate the grant.
 * Safe to call repeatedly — never resets an existing emailKey grant.
 */
export const ensureTrialGrant = authedMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    if (isSelfHosted()) {
      return null;
    }
    await rateLimiter.limit(ctx, "ensureTrialGrant", { key: ctx.userId, throws: true });
    const user = await ctx.db.get("users", ctx.userId);
    if (user?.email) {
      await claimTrialGrant(ctx, ctx.userId, user.email);
    }
    return null;
  },
});
