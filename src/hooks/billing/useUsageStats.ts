import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { UsageStatsSummary } from "../../../convex/lib/usageTracking";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

/** Social-proof stats change slowly; optimistic track mutations keep the chip snappy. */

export function usageStatsQueryKey() {
  return convexQuery(api.usage.summary, {}).queryKey;
}

export function useUsageStats() {
  return useAuthedQuery(api.usage.summary, {}, { gcTime: GC_TIME.realtime });
}

export type { UsageStatsSummary };
