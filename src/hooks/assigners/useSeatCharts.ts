import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { FIVE_MINUTES } from "@/lib/queryCache";

export function seatChartsListQueryKey(classId: Id<"classes">) {
  return convexQuery(api.seatCharts.list, { classId }).queryKey;
}

/** gcTime: 5 minutes — matches other assigners queries. */
export function useSeatCharts(classId: Id<"classes">) {
  return useAuthedQuery(api.seatCharts.list, { classId }, { gcTime: FIVE_MINUTES });
}
