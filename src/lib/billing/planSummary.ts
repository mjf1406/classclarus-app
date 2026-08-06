import type { DerivedEntitlement } from "@/lib/billing/entitlement";
import { formatBillingDate } from "@/lib/billing/format";

export type PlanSummarySubscription = {
  productKey: string | null;
  productName: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  endsAt: string | null;
};

export type PlanSummaryInput = {
  entitlement: DerivedEntitlement | null;
  subscription: PlanSummarySubscription | null;
  locale: string;
  t: (key: string, options?: Record<string, unknown>) => string;
};

export type PlanSummary = {
  /** Short label for nav (Free / Trial / Pro). */
  compactLabel: string;
  /** One-line status for the account billing card. */
  line: string;
};

function planName(subscription: PlanSummarySubscription | null, t: PlanSummaryInput["t"]): string {
  if (!subscription) {
    return t("proLabel");
  }
  if (subscription.productKey === "proYearly") {
    return t("yearlyTitle");
  }
  if (subscription.productKey === "proMonthly") {
    return t("monthlyTitle");
  }
  return subscription.productName?.trim() || t("proLabel");
}

/**
 * Build compact + one-line plan copy from entitlement + subscription.
 * Keep `Date.now()` out of Convex — call this on the client with derived entitlement.
 */
export function buildPlanSummary({
  entitlement,
  subscription,
  locale,
  t,
}: PlanSummaryInput): PlanSummary {
  if (!entitlement) {
    return {
      compactLabel: t("freeTitle"),
      line: t("freeTitle"),
    };
  }

  if (entitlement.status === "active" && subscription) {
    const name = planName(subscription, t);
    const endDate =
      formatBillingDate(subscription.endsAt ?? subscription.currentPeriodEnd, locale) ??
      t("dateUnknown");

    if (subscription.cancelAtPeriodEnd) {
      return {
        compactLabel: t("proLabel"),
        line: t("summaryCancels", { plan: name, date: endDate }),
      };
    }

    return {
      compactLabel: t("proLabel"),
      line: t("summaryRenews", { plan: name, date: endDate }),
    };
  }

  if (entitlement.status === "trialing") {
    const count = entitlement.daysRemaining ?? 0;
    return {
      compactLabel: t("trialLabel"),
      line: t("trialActive", { count }),
    };
  }

  if (entitlement.status === "expired") {
    return {
      compactLabel: t("freeTitle"),
      line: t("trialExpiredTitle"),
    };
  }

  return {
    compactLabel: t("freeTitle"),
    line: t("freeTitle"),
  };
}
