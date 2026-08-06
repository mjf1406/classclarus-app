import { TableAggregate } from "@convex-dev/aggregate";

import { components } from "../_generated/api.js";
import type { DataModel } from "../_generated/dataModel.js";
import { isSelfHosted } from "./selfHosted.js";

/** Convex env — set `true` only on the production deployment. */
export function isUsageTrackingEnabled(): boolean {
  return process.env.USAGE_TRACKING_ENABLED === "true" && !isSelfHosted();
}

/**
 * Convex env — set `true` on a **dev** deployment to render canned Free-card
 * stats without writing events or calling GitHub. Ignored when self-hosted.
 * Do not enable on production.
 */
export function isUsageTrackingDemo(): boolean {
  return process.env.USAGE_TRACKING_DEMO === "true" && !isSelfHosted();
}

export type UsageEventKind = "desktop_download" | "self_host_click";
export type DesktopOs = "windows" | "mac" | "ubuntu";

export type StatsPeriod = "today" | "week" | "twoWeeks" | "month" | "year" | "allTime";

export const STATS_PERIODS: readonly StatsPeriod[] = [
  "today",
  "week",
  "twoWeeks",
  "month",
  "year",
  "allTime",
] as const;

export const CHIP_PERIOD_ORDER: readonly StatsPeriod[] = STATS_PERIODS;

export const usageByKind = new TableAggregate<{
  Namespace: UsageEventKind;
  Key: number;
  DataModel: DataModel;
  TableName: "anonymousUsageEvents";
}>(components.usageByKind, {
  namespace: (doc) => doc.kind,
  sortKey: (doc) => doc._creationTime,
});

export const usageByDownloadOs = new TableAggregate<{
  Namespace: DesktopOs;
  Key: number;
  DataModel: DataModel;
  TableName: "anonymousUsageEvents";
}>(components.usageByDownloadOs, {
  namespace: (doc) => {
    if (doc.kind !== "desktop_download" || !doc.os) {
      throw new Error("usageByDownloadOs expects desktop_download with os");
    }
    return doc.os;
  },
  sortKey: (doc) => doc._creationTime,
});

export const githubClonesAggregate = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "githubCloneDays";
}>(components.githubClones, {
  sortKey: (doc) => doc.dayStartMs,
  sumValue: (doc) => doc.count,
});

const DAY_MS = 24 * 60 * 60 * 1000;

export function utcDayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function utcDayStartMs(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Inclusive lower / exclusive upper bounds for Aggregate time ranges. */
export function periodBounds(
  period: StatsPeriod,
  nowMs: number,
):
  | { lower?: { key: number; inclusive: boolean }; upper?: { key: number; inclusive: boolean } }
  | undefined {
  if (period === "allTime") {
    return undefined;
  }
  const todayStart = utcDayStartMs(nowMs);
  const upper = { key: nowMs + 1, inclusive: false as const };
  switch (period) {
    case "today":
      return { lower: { key: todayStart, inclusive: true }, upper };
    case "week":
      return { lower: { key: todayStart - 7 * DAY_MS, inclusive: true }, upper };
    case "twoWeeks":
      return { lower: { key: todayStart - 14 * DAY_MS, inclusive: true }, upper };
    case "month":
      return { lower: { key: todayStart - 30 * DAY_MS, inclusive: true }, upper };
    case "year":
      return { lower: { key: todayStart - 365 * DAY_MS, inclusive: true }, upper };
    default:
      return undefined;
  }
}

export function emptyOsCounts(): Record<DesktopOs, number> {
  return { windows: 0, mac: 0, ubuntu: 0 };
}

export function emptyPeriodCounts(): Record<StatsPeriod, number> {
  return {
    today: 0,
    week: 0,
    twoWeeks: 0,
    month: 0,
    year: 0,
    allTime: 0,
  };
}

export type UsageChip = { count: number; period: StatsPeriod };

export type UsageStatsSummary = {
  enabled: boolean;
  downloads: Record<StatsPeriod, number>;
  downloadsByOs: Record<StatsPeriod, Record<DesktopOs, number>>;
  selfHostClicks: Record<StatsPeriod, number>;
  clones: Record<StatsPeriod, number>;
  downloadChip: UsageChip | null;
  selfHostChip: UsageChip | null;
};

export function pickChip(counts: Record<StatsPeriod, number>): UsageChip | null {
  for (const period of CHIP_PERIOD_ORDER) {
    const count = counts[period];
    if (count > 0) {
      return { count, period };
    }
  }
  return null;
}

export function emptyUsageStatsSummary(): UsageStatsSummary {
  return {
    enabled: false,
    downloads: emptyPeriodCounts(),
    downloadsByOs: {
      today: emptyOsCounts(),
      week: emptyOsCounts(),
      twoWeeks: emptyOsCounts(),
      month: emptyOsCounts(),
      year: emptyOsCounts(),
      allTime: emptyOsCounts(),
    },
    selfHostClicks: emptyPeriodCounts(),
    clones: emptyPeriodCounts(),
    downloadChip: null,
    selfHostChip: null,
  };
}

/** Fixed sample numbers for UI review when `USAGE_TRACKING_DEMO=true`. */
export function demoUsageStatsSummary(): UsageStatsSummary {
  const os = (windows: number, mac: number, ubuntu: number) => ({
    windows,
    mac,
    ubuntu,
  });
  return {
    enabled: true,
    downloads: {
      today: 12,
      week: 47,
      twoWeeks: 81,
      month: 156,
      year: 940,
      allTime: 1284,
    },
    downloadsByOs: {
      today: os(5, 4, 3),
      week: os(18, 16, 13),
      twoWeeks: os(31, 28, 22),
      month: os(62, 54, 40),
      year: os(380, 340, 220),
      allTime: os(520, 460, 304),
    },
    selfHostClicks: {
      today: 3,
      week: 14,
      twoWeeks: 22,
      month: 41,
      year: 210,
      allTime: 287,
    },
    clones: {
      today: 2,
      week: 9,
      twoWeeks: 15,
      month: 28,
      year: 120,
      allTime: 168,
    },
    downloadChip: { count: 12, period: "today" },
    selfHostChip: { count: 3, period: "today" },
  };
}

/**
 * Checkouts per successful `electron-release` workflow run:
 * 3× matrix build + release + sync-version (see .github/workflows/electron-release.yml).
 */
export const CI_CHECKOUTS_PER_ELECTRON_RELEASE = 5;

export function parseGithubOwnerRepo(githubUrl: string): { owner: string; repo: string } | null {
  try {
    const url = new URL(githubUrl);
    if (url.hostname !== "github.com") {
      return null;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      return null;
    }
    return { owner: parts[0]!, repo: parts[1]!.replace(/\.git$/, "") };
  } catch {
    return null;
  }
}
