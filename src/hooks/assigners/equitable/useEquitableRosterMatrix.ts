import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export function equitableRosterMatrixQueryKey(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners">,
) {
  return convexQuery(api.equitableAssigners.rosterMatrix, { classId, assignerId }).queryKey;
}

/** gcTime: GC_TIME.realtime — equitable roster matrix derived from run history. */
export function useEquitableRosterMatrix(
  classId: Id<"classes">,
  assignerId: Id<"equitableAssigners"> | undefined,
) {
  return useAuthedQuery(
    api.equitableAssigners.rosterMatrix,
    assignerId ? { classId, assignerId } : "skip",
    { gcTime: GC_TIME.realtime },
  );
}
