import { v } from "convex/values";

import { authedMutation, authedQuery } from "./lib/customFunctions.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import {
  demoUsageStatsSummary,
  emptyUsageStatsSummary,
  githubClonesAggregate,
  isUsageTrackingDemo,
  isUsageTrackingEnabled,
  periodBounds,
  pickChip,
  STATS_PERIODS,
  usageByDownloadOs,
  usageByKind,
  type DesktopOs,
  type StatsPeriod,
  type UsageStatsSummary,
} from "./lib/usageTracking.js";

const desktopOsValidator = v.union(v.literal("windows"), v.literal("mac"), v.literal("ubuntu"));

const periodCountValidator = v.object({
  today: v.number(),
  week: v.number(),
  twoWeeks: v.number(),
  month: v.number(),
  year: v.number(),
  allTime: v.number(),
});

const osCountValidator = v.object({
  windows: v.number(),
  mac: v.number(),
  ubuntu: v.number(),
});

const chipValidator = v.union(
  v.object({
    count: v.number(),
    period: v.union(
      v.literal("today"),
      v.literal("week"),
      v.literal("twoWeeks"),
      v.literal("month"),
      v.literal("year"),
      v.literal("allTime"),
    ),
  }),
  v.null(),
);

const summaryValidator = v.object({
  enabled: v.boolean(),
  downloads: periodCountValidator,
  downloadsByOs: v.object({
    today: osCountValidator,
    week: osCountValidator,
    twoWeeks: osCountValidator,
    month: osCountValidator,
    year: osCountValidator,
    allTime: osCountValidator,
  }),
  selfHostClicks: periodCountValidator,
  clones: periodCountValidator,
  downloadChip: chipValidator,
  selfHostChip: chipValidator,
});

async function countKind(
  ctx: Parameters<typeof usageByKind.count>[0],
  kind: "desktop_download" | "self_host_click",
  period: StatsPeriod,
  nowMs: number,
): Promise<number> {
  const bounds = periodBounds(period, nowMs);
  return usageByKind.count(ctx, {
    namespace: kind,
    ...(bounds ? { bounds } : {}),
  });
}

async function countDownloadOs(
  ctx: Parameters<typeof usageByDownloadOs.count>[0],
  os: DesktopOs,
  period: StatsPeriod,
  nowMs: number,
): Promise<number> {
  const bounds = periodBounds(period, nowMs);
  return usageByDownloadOs.count(ctx, {
    namespace: os,
    ...(bounds ? { bounds } : {}),
  });
}

async function sumClones(
  ctx: Parameters<typeof githubClonesAggregate.sum>[0],
  period: StatsPeriod,
  nowMs: number,
): Promise<number> {
  const bounds = periodBounds(period, nowMs);
  return githubClonesAggregate.sum(ctx, bounds ? { bounds } : {});
}

export const summary = authedQuery({
  args: {},
  returns: summaryValidator,
  handler: async (ctx): Promise<UsageStatsSummary> => {
    if (!isUsageTrackingEnabled()) {
      return isUsageTrackingDemo() ? demoUsageStatsSummary() : emptyUsageStatsSummary();
    }

    const nowMs = Date.now();
    const result = emptyUsageStatsSummary();
    result.enabled = true;

    for (const period of STATS_PERIODS) {
      result.downloads[period] = await countKind(ctx, "desktop_download", period, nowMs);
      result.selfHostClicks[period] = await countKind(ctx, "self_host_click", period, nowMs);
      result.clones[period] = await sumClones(ctx, period, nowMs);
      result.downloadsByOs[period] = {
        windows: await countDownloadOs(ctx, "windows", period, nowMs),
        mac: await countDownloadOs(ctx, "mac", period, nowMs),
        ubuntu: await countDownloadOs(ctx, "ubuntu", period, nowMs),
      };
    }

    result.downloadChip = pickChip(result.downloads);
    result.selfHostChip = pickChip(result.selfHostClicks);
    return result;
  },
});

export const trackDesktopDownload = authedMutation({
  args: { os: desktopOsValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!isUsageTrackingEnabled()) {
      return null;
    }

    await rateLimiter.limit(ctx, "usageTrackDownloadGlobal", { key: "global", throws: true });
    await rateLimiter.limit(ctx, "usageTrackDownload", { key: ctx.userId, throws: true });

    const id = await ctx.db.insert("anonymousUsageEvents", {
      kind: "desktop_download",
      os: args.os,
    });
    const doc = await ctx.db.get("anonymousUsageEvents", id);
    if (!doc) {
      return null;
    }
    await usageByKind.insert(ctx, doc);
    await usageByDownloadOs.insert(ctx, doc);
    return null;
  },
});

export const trackSelfHostClick = authedMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    if (!isUsageTrackingEnabled()) {
      return null;
    }

    await rateLimiter.limit(ctx, "usageTrackSelfHostGlobal", { key: "global", throws: true });
    await rateLimiter.limit(ctx, "usageTrackSelfHost", { key: ctx.userId, throws: true });

    const id = await ctx.db.insert("anonymousUsageEvents", {
      kind: "self_host_click",
    });
    const doc = await ctx.db.get("anonymousUsageEvents", id);
    if (!doc) {
      return null;
    }
    await usageByKind.insert(ctx, doc);
    return null;
  },
});
