import { APP_CONFIG } from "@/config/app";

export type EntitlementStatus = "trialing" | "active" | "expired";

export type EntitlementInput = {
  trialEndsAt: number | null;
  subscriptionStatus: string | null;
};

export type DerivedEntitlement = {
  status: EntitlementStatus;
  daysRemaining: number | null;
  /** True when within `warnWithinDays` of trial end and not subscribed. */
  showWarningBanner: boolean;
  /** True when within `forceWithinDays` of trial end (banner not dismissible). */
  forceBanner: boolean;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/**
 * Derive entitlement status from raw billing fields + a client clock.
 * Keep `Date.now()` out of Convex queries — call this on the client.
 */
export function deriveEntitlement(
  input: EntitlementInput,
  now: number = Date.now(),
): DerivedEntitlement {
  if (input.subscriptionStatus && ACTIVE_STATUSES.has(input.subscriptionStatus)) {
    return {
      status: "active",
      daysRemaining: null,
      showWarningBanner: false,
      forceBanner: false,
    };
  }

  if (input.trialEndsAt !== null && input.trialEndsAt > now) {
    const daysRemaining = Math.max(0, Math.ceil((input.trialEndsAt - now) / MS_PER_DAY));
    const { warnWithinDays, forceWithinDays } = APP_CONFIG.trial;
    return {
      status: "trialing",
      daysRemaining,
      showWarningBanner: daysRemaining <= warnWithinDays,
      forceBanner: daysRemaining <= forceWithinDays,
    };
  }

  return {
    status: "expired",
    daysRemaining: 0,
    showWarningBanner: false,
    forceBanner: false,
  };
}
