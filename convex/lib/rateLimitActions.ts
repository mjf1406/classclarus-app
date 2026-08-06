import { ConvexError, v } from "convex/values";

import { internalMutation } from "../_generated/server.js";
import { rateLimiter, type RateLimitName } from "./rateLimiter.js";

const rateLimitNameValidator = v.union(
  v.literal("billingCheckout"),
  v.literal("billingCheckoutGlobal"),
  v.literal("billingPortal"),
  v.literal("billingPortalGlobal"),
  v.literal("billingChange"),
  v.literal("billingChangeGlobal"),
  v.literal("billingCancel"),
  v.literal("billingCancelGlobal"),
  v.literal("billingOrders"),
  v.literal("billingOrdersGlobal"),
  v.literal("fileFinalize"),
  v.literal("fileFinalizeGlobal"),
  v.literal("fileGetBytes"),
  v.literal("fileGetBytesGlobal"),
  v.literal("signOutOtherSessions"),
  v.literal("adminResetPassword"),
);

/**
 * Consume a rate-limit bucket from an action via `ctx.runMutation`.
 * The rate-limiter component requires a mutation context.
 */
export const consume = internalMutation({
  args: {
    name: rateLimitNameValidator,
    key: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, args.name as RateLimitName, {
      key: args.key,
      throws: true,
    });
    return null;
  },
});

export function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof ConvexError)) {
    return false;
  }
  const data = error.data;
  if (typeof data === "object" && data !== null && "kind" in data) {
    return (data as { kind?: string }).kind === "RateLimited";
  }
  return false;
}
