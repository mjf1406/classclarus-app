import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";

export function randomRosterMatrixQueryKey(
  classId: Id<"classes">,
  assignerId: Id<"randomAssigners">,
) {
  return convexQuery(api.randomAssigners.rosterMatrix, { classId, assignerId }).queryKey;
}

/** gcTime: ONE_HOUR — random roster matrix derived from run history. */
export function useRandomRosterMatrix(
  classId: Id<"classes">,
  assignerId: Id<"randomAssigners"> | undefined,
) {
  return useAuthedQuery(
    api.randomAssigners.rosterMatrix,
    assignerId ? { classId, assignerId } : "skip",
    { gcTime: ONE_HOUR },
  );
}
