import type { TFunction } from "i18next";

export type PurchaseLimitPeriod = "day" | "week" | "month";

export type PurchaseLimit = {
  maxPurchases: number;
  type: "recurring";
  period: PurchaseLimitPeriod;
  every: number;
};

export const PURCHASE_LIMIT_PERIODS: Array<PurchaseLimitPeriod> = ["day", "week", "month"];

export type PurchaseLimitFormValues = {
  enabled: boolean;
  maxPurchases: string;
  period: PurchaseLimitPeriod;
  every: string;
};

export function emptyPurchaseLimitFormValues(): PurchaseLimitFormValues {
  return {
    enabled: false,
    maxPurchases: "1",
    period: "week",
    every: "1",
  };
}

export function purchaseLimitToFormValues(
  limit: PurchaseLimit | undefined,
): PurchaseLimitFormValues {
  if (!limit) return emptyPurchaseLimitFormValues();
  return {
    enabled: true,
    maxPurchases: String(limit.maxPurchases),
    period: limit.period,
    every: String(limit.every),
  };
}

export function formValuesToPurchaseLimit(
  values: PurchaseLimitFormValues,
): PurchaseLimit | undefined {
  if (!values.enabled) return undefined;
  return {
    maxPurchases: Number(values.maxPurchases),
    type: "recurring",
    period: values.period,
    every: Number(values.every),
  };
}

/** Short card summary, e.g. "Max 3 / every 1 week". */
export function formatPurchaseLimitSummary(
  limit: PurchaseLimit,
  labels: {
    max: (count: number) => string;
    every: (count: number, period: string) => string;
    period: (period: PurchaseLimitPeriod) => string;
  },
): string {
  const periodLabel = labels.period(limit.period);
  return `${labels.max(limit.maxPurchases)} · ${labels.every(limit.every, periodLabel)}`;
}

/** Validation for purchase-limit form strings. */
export function validatePurchaseLimitFormValues(
  values: PurchaseLimitFormValues,
  t: TFunction<"rewards">,
): Partial<Record<"maxPurchases" | "every", string>> | undefined {
  if (!values.enabled) return undefined;
  const errors: Partial<Record<"maxPurchases" | "every", string>> = {};
  if (!/^\d+$/.test(values.maxPurchases.trim()) || Number(values.maxPurchases) < 1) {
    errors.maxPurchases = t("purchaseLimitMaxInvalid");
  }
  if (!/^\d+$/.test(values.every.trim()) || Number(values.every) < 1) {
    errors.every = t("purchaseLimitEveryInvalid");
  }
  return Object.keys(errors).length > 0 ? errors : undefined;
}
