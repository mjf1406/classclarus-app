import { convexQuery } from "@convex-dev/react-query";

import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";
import { api } from "../../../convex/_generated/api";

export function razInitialLevelsQueryKey(classId: Id<"classes">) {
  return convexQuery(api.raz.listInitialLevels, { classId }).queryKey;
}

/** gcTime: 1 hour — reactive via Convex; matches student roster. */
export function useRazInitialLevels(classId: Id<"classes">) {
  return useAuthedQuery(api.raz.listInitialLevels, { classId }, { gcTime: ONE_HOUR });
}
