import { convexQuery } from "@convex-dev/react-query";

import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { api } from "../../../convex/_generated/api";
import { GC_TIME } from "@/lib/queryCache";

export function razForAudienceQueryKey(classId: Id<"classes">) {
  return convexQuery(api.raz.forAudience, { classId }).queryKey;
}

/** gcTime: GC_TIME.realtime — same as other personal class queries; Convex keeps the live query fresh while mounted. */
export function useRazForAudience(classId: Id<"classes">) {
  return useAuthedQuery(api.raz.forAudience, { classId }, { gcTime: GC_TIME.realtime });
}
