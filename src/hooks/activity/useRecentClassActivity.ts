import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { DASHBOARD_ACTIVITY_LIMIT } from "@/lib/dashboard/dashboard";
import { GC_TIME } from "@/lib/queryCache";

export function recentClassActivityQueryKey(classId: Id<"classes">) {
  return convexQuery(api.activity.list, {
    classId,
    paginationOpts: { numItems: DASHBOARD_ACTIVITY_LIMIT, cursor: null },
  }).queryKey;
}

/** gcTime: GC_TIME.realtime — staff dashboard snippet; Convex keeps the live query fresh while mounted. */
export function useRecentClassActivity(classId: Id<"classes">) {
  return useAuthedQuery(
    api.activity.list,
    {
      classId,
      paginationOpts: { numItems: DASHBOARD_ACTIVITY_LIMIT, cursor: null },
    },
    { gcTime: GC_TIME.realtime },
  );
}
