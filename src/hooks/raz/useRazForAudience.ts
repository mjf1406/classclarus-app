import { convexQuery } from "@convex-dev/react-query";

import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";
import { api } from "../../../convex/_generated/api";

export function razForAudienceQueryKey(classId: Id<"classes">) {
  return convexQuery(api.raz.forAudience, { classId }).queryKey;
}

/** gcTime: ONE_HOUR — same as other personal class queries; Convex keeps the live query fresh while mounted. */
export function useRazForAudience(classId: Id<"classes">) {
  return useAuthedQuery(api.raz.forAudience, { classId }, { gcTime: ONE_HOUR });
}
