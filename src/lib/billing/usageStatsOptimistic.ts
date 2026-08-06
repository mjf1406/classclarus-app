import type { DesktopOs, UsageStatsSummary } from "../../../convex/lib/usageTracking";
import { pickChip, STATS_PERIODS } from "../../../convex/lib/usageTracking";

function bumpPeriods(counts: UsageStatsSummary["downloads"]): UsageStatsSummary["downloads"] {
  const next = { ...counts };
  for (const period of STATS_PERIODS) {
    next[period] += 1;
  }
  return next;
}

export function bumpDesktopDownload(stats: UsageStatsSummary, os: DesktopOs): UsageStatsSummary {
  if (!stats.enabled) {
    return stats;
  }
  const downloads = bumpPeriods(stats.downloads);
  const downloadsByOs = { ...stats.downloadsByOs };
  for (const period of STATS_PERIODS) {
    downloadsByOs[period] = {
      ...downloadsByOs[period],
      [os]: downloadsByOs[period][os] + 1,
    };
  }
  return {
    ...stats,
    downloads,
    downloadsByOs,
    downloadChip: pickChip(downloads),
  };
}

export function bumpSelfHostClick(stats: UsageStatsSummary): UsageStatsSummary {
  if (!stats.enabled) {
    return stats;
  }
  const selfHostClicks = bumpPeriods(stats.selfHostClicks);
  return {
    ...stats,
    selfHostClicks,
    selfHostChip: pickChip(selfHostClicks),
  };
}
