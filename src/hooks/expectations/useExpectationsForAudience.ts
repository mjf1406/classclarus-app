import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export function expectationsForAudienceQueryKey(classId: Id<"classes">) {
  return convexQuery(api.expectations.forAudience, { classId }).queryKey;
}

/** gcTime: 5 minutes — same as useExpectations; Convex keeps the live query fresh while mounted. */
export function useExpectationsForAudience(classId: Id<"classes">) {
  return useAuthedQuery(api.expectations.forAudience, { classId }, { gcTime: GC_TIME.realtime });
}
