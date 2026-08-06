import { ordersList } from "@polar-sh/sdk/funcs/ordersList.js";
import { unwrapResultIterator } from "@polar-sh/sdk/types/operations.js";
import { ConvexError, v } from "convex/values";

import { api, internal } from "./_generated/api.js";
import { action } from "./_generated/server.js";
import { assertConfiguredProduct, resolveAppOrigin, resolveAppUrl } from "./lib/billingGuards.js";
import { isAlreadyCanceledError, throwBillingError } from "./lib/polarErrors.js";
import { isSelfHosted } from "./lib/selfHosted.js";
import { polar } from "./polar.js";

function assertCloudBilling(): void {
  if (isSelfHosted()) {
    throw new ConvexError({
      code: "SELF_HOSTED",
      message: "Billing is disabled in self-hosted mode.",
    });
  }
}

const orderItemValidator = v.object({
  id: v.string(),
  description: v.string(),
  status: v.string(),
  createdAt: v.string(),
  totalAmount: v.number(),
  currency: v.string(),
  paid: v.boolean(),
});

const orderHistoryValidator = v.object({
  items: v.array(orderItemValidator),
  page: v.number(),
  maxPage: v.number(),
  totalCount: v.number(),
});

async function requireBillingUser(ctx: {
  runQuery: (
    ref: typeof api.users.currentUser,
    args: Record<string, never>,
  ) => Promise<{ _id: string; email?: string } | null>;
}) {
  const user = await ctx.runQuery(api.users.currentUser, {});
  if (!user?.email) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Not authenticated",
    });
  }
  return { userId: user._id, email: user.email };
}

async function consumeBillingLimit(
  ctx: {
    runMutation: (
      ref: typeof internal.lib.rateLimitActions.consume,
      args: {
        name:
          | "billingCheckout"
          | "billingCheckoutGlobal"
          | "billingPortal"
          | "billingPortalGlobal"
          | "billingChange"
          | "billingChangeGlobal"
          | "billingCancel"
          | "billingCancelGlobal"
          | "billingOrders"
          | "billingOrdersGlobal";
        key: string;
      },
    ) => Promise<null>;
  },
  name: "billingCheckout" | "billingPortal" | "billingChange" | "billingCancel" | "billingOrders",
  userId: string,
) {
  const globalName = `${name}Global` as
    | "billingCheckoutGlobal"
    | "billingPortalGlobal"
    | "billingChangeGlobal"
    | "billingCancelGlobal"
    | "billingOrdersGlobal";
  await ctx.runMutation(internal.lib.rateLimitActions.consume, {
    name: globalName,
    key: "global",
  });
  await ctx.runMutation(internal.lib.rateLimitActions.consume, {
    name,
    key: userId,
  });
}

/**
 * Cancel the current subscription at period end.
 * Already-canceled Polar responses are treated as success (idempotent).
 */
export const cancelSubscription = action({
  args: {
    revokeImmediately: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertCloudBilling();
    const { userId } = await requireBillingUser(ctx);
    await consumeBillingLimit(ctx, "billingCancel", userId);

    try {
      const current = await polar.getCurrentSubscription(ctx, { userId });
      if (current?.cancelAtPeriodEnd && !args.revokeImmediately) {
        return null;
      }

      await polar.cancelSubscription(ctx, {
        revokeImmediately: args.revokeImmediately,
      });
      return null;
    } catch (error) {
      if (isAlreadyCanceledError(error)) {
        return null;
      }
      throwBillingError(
        error,
        "CANCEL_FAILED",
        "Could not cancel subscription",
        "cancelSubscription",
      );
    }
  },
});

/**
 * Change the current subscription product (monthly ↔ yearly).
 */
export const changeSubscription = action({
  args: {
    productId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertCloudBilling();
    const { userId } = await requireBillingUser(ctx);
    await consumeBillingLimit(ctx, "billingChange", userId);
    assertConfiguredProduct(args.productId);

    try {
      await polar.changeSubscription(ctx, { productId: args.productId });
      return null;
    } catch (error) {
      throwBillingError(error, "CHANGE_FAILED", "Could not change plan", "changeSubscription");
    }
  },
});

/**
 * Paginated order history for the signed-in Polar customer.
 */
export const listOrders = action({
  args: {
    page: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: orderHistoryValidator,
  handler: async (ctx, args) => {
    assertCloudBilling();
    const { userId } = await requireBillingUser(ctx);
    await consumeBillingLimit(ctx, "billingOrders", userId);
    const page = Math.max(1, args.page ?? 1);
    const limit = Math.min(50, Math.max(1, args.limit ?? 10));

    const customer = await polar.getCustomerByUserId(ctx, userId);
    if (!customer) {
      return {
        items: [],
        page,
        maxPage: 1,
        totalCount: 0,
      };
    }

    try {
      const response = await unwrapResultIterator(
        ordersList(polar.polar, {
          customerId: customer.id,
          page,
          limit,
          sorting: ["-created_at"],
        }),
      );

      const list = response.result;
      return {
        items: list.items.map((order) => ({
          id: order.id,
          description: order.description || order.product?.name || "Order",
          status: order.status,
          createdAt: order.createdAt.toISOString(),
          totalAmount: order.totalAmount,
          currency: order.currency,
          paid: order.paid,
        })),
        page,
        maxPage: list.pagination.maxPage,
        totalCount: list.pagination.totalCount,
      };
    } catch (error) {
      if (error instanceof ConvexError) {
        throw error;
      }
      throwBillingError(error, "ORDERS_FAILED", "Could not load order history", "listOrders");
    }
  },
});

/**
 * Customer portal URL. Return URL is always the app `/billing` page.
 */
export const generateCustomerPortalUrl = action({
  args: {},
  returns: v.object({ url: v.string() }),
  handler: async (ctx) => {
    assertCloudBilling();
    const { userId } = await requireBillingUser(ctx);
    await consumeBillingLimit(ctx, "billingPortal", userId);

    try {
      return await polar.createCustomerPortalSession(ctx, {
        userId,
        returnUrl: resolveAppUrl("/billing"),
      });
    } catch (error) {
      throwBillingError(
        error,
        "PORTAL_FAILED",
        "Could not open Polar portal",
        "generateCustomerPortalUrl",
      );
    }
  },
});

/**
 * Checkout link for a configured product. URLs are built server-side.
 */
export const createCheckoutLink = action({
  args: {
    productId: v.string(),
  },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    assertCloudBilling();
    const { userId, email } = await requireBillingUser(ctx);
    await consumeBillingLimit(ctx, "billingCheckout", userId);
    assertConfiguredProduct(args.productId);

    try {
      const checkout = await polar.createCheckoutSession(ctx, {
        productIds: [args.productId],
        userId,
        email,
        origin: resolveAppOrigin(),
        successUrl: resolveAppUrl("/billing"),
      });
      return { url: checkout.url };
    } catch (error) {
      throwBillingError(error, "CHECKOUT_FAILED", "Could not start checkout", "createCheckoutLink");
    }
  },
});
