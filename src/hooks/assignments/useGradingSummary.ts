import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export function gradingSummaryQueryKey(classId: Id<"classes">) {
  return convexQuery(api.assignments.gradingSummary, { classId }).queryKey;
}

/** gcTime: GC_TIME.realtime — staff dashboard; Convex keeps the live query fresh while mounted. */
export function useGradingSummary(classId: Id<"classes">) {
  return useAuthedQuery(api.assignments.gradingSummary, { classId }, { gcTime: GC_TIME.realtime });
}
