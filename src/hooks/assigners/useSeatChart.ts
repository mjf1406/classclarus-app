import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { FIVE_MINUTES } from "@/lib/queryCache";

export function seatChartQueryKey(classId: Id<"classes">, chartId: Id<"seatCharts">) {
  return convexQuery(api.seatCharts.get, { classId, chartId }).queryKey;
}

/** gcTime: 5 minutes — reactive chart editor state. */
export function useSeatChart(classId: Id<"classes">, chartId: Id<"seatCharts">) {
  return useAuthedQuery(api.seatCharts.get, { classId, chartId }, { gcTime: FIVE_MINUTES });
}
