import { ConvexError } from "convex/values";

import type { Id } from "../_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "../_generated/server.js";
import { polar } from "../polar.js";
import { isSelfHosted } from "./selfHosted.js";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/**
 * Throws if the user has no active/trialing Polar subscription and their
 * app-managed trial has ended. Read-only — does not claim a trial grant.
 *
 * Query-safe: uses the scheduled `expiredAt` flag instead of `Date.now()`.
 * Per-grant `markExpired` flips that flag at `endsAt`; a 5-minute cron sweep
 * is the safety net if that job is lost (worst-case entitled-read window).
 * Mutations also re-check `endsAt` so a delayed flip cannot grant a write window.
 *
 * Self-hosted Docker installs always pass (Polar is disabled).
 */
export async function assertEntitled(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  if (isSelfHosted()) {
    return;
  }

  const subscription = await polar.getCurrentSubscription(ctx, { userId });
  if (subscription && ACTIVE_STATUSES.has(subscription.status)) {
    return;
  }

  const grant = await ctx.db
    .query("trialGrants")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();

  if (grant && grant.expiredAt === undefined) {
    // Belt-and-braces on mutations only: reject if endsAt has passed but the
    // scheduled job has not yet flipped expiredAt.
    if ("scheduler" in ctx && grant.endsAt <= Date.now()) {
      throw new ConvexError({
        code: "SUBSCRIPTION_REQUIRED",
        message: "Subscription required. Your free trial has ended.",
      });
    }
    return;
  }

  throw new ConvexError({
    code: "SUBSCRIPTION_REQUIRED",
    message: "Subscription required. Your free trial has ended.",
  });
}

/** @deprecated Prefer `assertEntitled` — kept as an alias during migration. */
export const requireEntitlement = assertEntitled;
