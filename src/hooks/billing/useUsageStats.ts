import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { UsageStatsSummary } from "../../../convex/lib/usageTracking";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";

/** Social-proof stats change slowly; optimistic track mutations keep the chip snappy. */
export const USAGE_STATS_GC_TIME = 5 * 60 * 1000;

export function usageStatsQueryKey() {
  return convexQuery(api.usage.summary, {}).queryKey;
}

export function useUsageStats() {
  return useAuthedQuery(api.usage.summary, {}, { gcTime: USAGE_STATS_GC_TIME });
}

export type { UsageStatsSummary };
