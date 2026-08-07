import { v } from "convex/values";

export const purchaseLimitValidator = v.object({
  maxPurchases: v.number(),
  type: v.literal("recurring"),
  period: v.union(v.literal("day"), v.literal("week"), v.literal("month")),
  every: v.number(),
});

export type PurchaseLimit = {
  maxPurchases: number;
  type: "recurring";
  period: "day" | "week" | "month";
  every: number;
};

const PERIODS = new Set(["day", "week", "month"]);

/** Normalize optional purchase limit; omit/undefined disables. */
export function normalizeOptionalPurchaseLimit(
  limit: PurchaseLimit | undefined,
): PurchaseLimit | undefined {
  if (limit === undefined) return undefined;
  if (!Number.isFinite(limit.maxPurchases) || !Number.isInteger(limit.maxPurchases)) {
    throw new Error("Maximum purchases must be a whole number");
  }
  if (limit.maxPurchases < 1) {
    throw new Error("Maximum purchases must be at least 1");
  }
  if (limit.type !== "recurring") {
    throw new Error("Limit type must be recurring");
  }
  if (!PERIODS.has(limit.period)) {
    throw new Error("Period must be day, week, or month");
  }
  if (!Number.isFinite(limit.every) || !Number.isInteger(limit.every)) {
    throw new Error("Every must be a whole number");
  }
  if (limit.every < 1) {
    throw new Error("Every must be at least 1");
  }
  return {
    maxPurchases: limit.maxPurchases,
    type: "recurring",
    period: limit.period,
    every: limit.every,
  };
}
