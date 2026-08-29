import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export function behaviorsListQueryKey(classId: Id<"classes">) {
  return convexQuery(api.behaviors.list, { classId }).queryKey;
}

export function behaviorsListQueryOptions(classId: Id<"classes">) {
  return convexQuery(api.behaviors.list, { classId });
}

/** gcTime: 5 minutes — reactive via Convex; moderate cache after unmount. */
export function useBehaviors(classId: Id<"classes">) {
  return useAuthedQuery(api.behaviors.list, { classId }, { gcTime: GC_TIME.realtime });
}
