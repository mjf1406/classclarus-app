import { v } from "convex/values";

export const purchaseLimitValidator = v.object({
  maxPurchases: v.number(),
  type: v.literal("recurring"),
  period: v.union(v.literal("day"), v.literal("week"), v.literal("month")),
  every: v.number(),
});

export type PurchaseLimitPeriod = "day" | "week" | "month";

export type PurchaseLimit = {
  maxPurchases: number;
  type: "recurring";
  period: PurchaseLimitPeriod;
  every: number;
};

export type PurchaseLimitWindow = {
  startMs: number;
  endMs: number;
};

const PERIODS = new Set(["day", "week", "month"]);
const MS_PER_DAY = 86_400_000;
/** Monday on or before Unix epoch (1970-01-01 was Thursday). */
const EPOCH_MONDAY_DAY_NUMBER = Math.floor(Date.UTC(1969, 11, 29) / MS_PER_DAY);

const PERIOD_VALIDATOR = v.union(v.literal("day"), v.literal("week"), v.literal("month"));

export const rewardPurchaseLimitStatusValidator = v.object({
  studentUserId: v.id("users"),
  rewardId: v.id("rewards"),
  usedInWindow: v.number(),
  kind: v.union(v.literal("item"), v.literal("folder")),
  maxPurchases: v.number(),
  period: PERIOD_VALIDATOR,
  every: v.number(),
  folderId: v.optional(v.id("rewardFolders")),
});

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

type LocalYmd = { year: number; month: number; day: number };

/** `timeZoneOffsetMinutes` is `Date#getTimezoneOffset()` (minutes to add to local to get UTC). */
export function localYmdFromUtcMs(ms: number, timeZoneOffsetMinutes: number): LocalYmd {
  const shifted = new Date(ms - timeZoneOffsetMinutes * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

function utcMsFromLocalYmd(ymd: LocalYmd, timeZoneOffsetMinutes: number): number {
  return Date.UTC(ymd.year, ymd.month, ymd.day) + timeZoneOffsetMinutes * 60_000;
}

function localDayNumber(ymd: LocalYmd): number {
  return Math.floor(Date.UTC(ymd.year, ymd.month, ymd.day) / MS_PER_DAY);
}

/** Monday (ISO) of the week containing `ymd`. */
export function startOfIsoWeek(ymd: LocalYmd): LocalYmd {
  const utcNoon = Date.UTC(ymd.year, ymd.month, ymd.day, 12);
  const dow = new Date(utcNoon).getUTCDay(); // 0 = Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(utcNoon);
  monday.setUTCDate(monday.getUTCDate() + mondayOffset);
  return {
    year: monday.getUTCFullYear(),
    month: monday.getUTCMonth(),
    day: monday.getUTCDate(),
  };
}

function localWeekIndex(ymd: LocalYmd): number {
  const monday = startOfIsoWeek(ymd);
  return Math.floor((localDayNumber(monday) - EPOCH_MONDAY_DAY_NUMBER) / 7);
}

function localMonthIndex(ymd: LocalYmd): number {
  return ymd.year * 12 + ymd.month;
}

/**
 * Calendar-aligned recurring window for `nowMs` in the teacher's local timezone.
 * `every` buckets consecutive days / ISO weeks / months.
 */
export function purchaseLimitWindow(
  nowMs: number,
  limit: Pick<PurchaseLimit, "period" | "every">,
  timeZoneOffsetMinutes: number,
): PurchaseLimitWindow {
  const every = limit.every;
  const ymd = localYmdFromUtcMs(nowMs, timeZoneOffsetMinutes);

  if (limit.period === "day") {
    const dayNum = localDayNumber(ymd);
    const bucketStart = Math.floor(dayNum / every) * every;
    const startMs = bucketStart * MS_PER_DAY + timeZoneOffsetMinutes * 60_000;
    const endMs = startMs + every * MS_PER_DAY;
    return { startMs, endMs };
  }

  if (limit.period === "week") {
    const weekIndex = localWeekIndex(ymd);
    const bucketStart = Math.floor(weekIndex / every) * every;
    const startDayNum = EPOCH_MONDAY_DAY_NUMBER + bucketStart * 7;
    const startMs = startDayNum * MS_PER_DAY + timeZoneOffsetMinutes * 60_000;
    const endMs = startMs + every * 7 * MS_PER_DAY;
    return { startMs, endMs };
  }

  const monthIndex = localMonthIndex(ymd);
  const bucketStart = Math.floor(monthIndex / every) * every;
  const startYear = Math.floor(bucketStart / 12);
  const startMonth = bucketStart - startYear * 12;
  const endIndex = bucketStart + every;
  const endYear = Math.floor(endIndex / 12);
  const endMonth = endIndex - endYear * 12;
  return {
    startMs: utcMsFromLocalYmd(
      { year: startYear, month: startMonth, day: 1 },
      timeZoneOffsetMinutes,
    ),
    endMs: utcMsFromLocalYmd({ year: endYear, month: endMonth, day: 1 }, timeZoneOffsetMinutes),
  };
}

export function isTimestampInPurchaseLimitWindow(
  purchasedAt: number,
  window: PurchaseLimitWindow,
): boolean {
  return purchasedAt >= window.startMs && purchasedAt < window.endMs;
}

export type EffectivePurchaseLimit<TRewardId, TFolderId> = {
  kind: "item" | "folder";
  limit: PurchaseLimit;
  /** Reward IDs that share this limit pool (quantity units). */
  poolRewardIds: Array<TRewardId>;
  folderId?: TFolderId;
};

type RewardLike<TRewardId, TFolderId> = {
  _id: TRewardId;
  folderId?: TFolderId;
  purchaseLimit?: PurchaseLimit;
};

type FolderLike<TFolderId> = {
  _id: TFolderId;
  purchaseLimit?: PurchaseLimit;
};

/** Item limit supersedes folder; folder aggregate skips rewards that have item limits. */
export function effectivePurchaseLimitForReward<TRewardId, TFolderId>(
  reward: RewardLike<TRewardId, TFolderId>,
  rewards: ReadonlyArray<RewardLike<TRewardId, TFolderId>>,
  foldersById: ReadonlyMap<TFolderId, FolderLike<TFolderId>>,
): EffectivePurchaseLimit<TRewardId, TFolderId> | null {
  if (reward.purchaseLimit) {
    return {
      kind: "item",
      limit: reward.purchaseLimit,
      poolRewardIds: [reward._id],
    };
  }
  if (reward.folderId === undefined) return null;
  const folder = foldersById.get(reward.folderId);
  if (!folder?.purchaseLimit) return null;
  const poolRewardIds = rewards
    .filter((entry) => entry.folderId === reward.folderId && entry.purchaseLimit === undefined)
    .map((entry) => entry._id);
  return {
    kind: "folder",
    limit: folder.purchaseLimit,
    poolRewardIds,
    folderId: folder._id,
  };
}

export function purchaseLimitPoolKey(kind: "item" | "folder", id: string): string {
  return `${kind}:${id}`;
}
