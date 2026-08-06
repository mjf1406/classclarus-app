import type { Subscription as PolarSdkSubscription } from "@polar-sh/sdk/models/components/subscription.js";
import type { Subscription } from "@convex-dev/polar";

function toIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

/**
 * Convert a Polar SDK subscription payload into the shape expected by
 * `@convex-dev/polar`'s `updateSubscription` / `createSubscription` mutations.
 */
export function toPolarComponentSubscription(subscription: PolarSdkSubscription): Subscription {
  return {
    id: subscription.id,
    customerId: subscription.customerId,
    createdAt: toIso(subscription.createdAt) ?? new Date(0).toISOString(),
    modifiedAt: toIso(subscription.modifiedAt),
    productId: subscription.productId,
    checkoutId: subscription.checkoutId,
    amount: subscription.amount,
    currency: subscription.currency,
    recurringInterval: subscription.recurringInterval,
    status: subscription.status,
    currentPeriodStart: toIso(subscription.currentPeriodStart) ?? new Date(0).toISOString(),
    currentPeriodEnd: toIso(subscription.currentPeriodEnd),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    customerCancellationReason: subscription.customerCancellationReason,
    customerCancellationComment: subscription.customerCancellationComment,
    startedAt: toIso(subscription.startedAt),
    endedAt: toIso(subscription.endedAt),
    metadata: subscription.metadata,
    discountId: subscription.discountId,
    canceledAt: toIso(subscription.canceledAt),
    endsAt: toIso(subscription.endsAt),
    recurringIntervalCount: subscription.recurringIntervalCount,
    trialStart: toIso(subscription.trialStart),
    trialEnd: toIso(subscription.trialEnd),
    seats: subscription.seats ?? null,
    customFieldData: subscription.customFieldData,
  };
}
