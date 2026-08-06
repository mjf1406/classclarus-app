import { convexQuery } from "@convex-dev/react-query";

import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { FIVE_MINUTES } from "@/lib/queryCache";

export function eligibleOwnersQueryKey(classId: Id<"classes">) {
  return convexQuery(api.classes.eligibleOwners, { classId }).queryKey;
}

/** Short-lived membership snapshot for ownership transfer (gcTime: 5 minutes). */
export function useEligibleOwners(classId: Id<"classes">) {
  return useAuthedQuery(api.classes.eligibleOwners, { classId }, { gcTime: FIVE_MINUTES });
}
