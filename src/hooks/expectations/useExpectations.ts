import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export function expectationsListQueryKey(classId: Id<"classes">) {
  return convexQuery(api.expectations.list, { classId }).queryKey;
}

/** gcTime: 5 minutes — reactive via Convex; moderate cache after unmount. */
export function useExpectations(classId: Id<"classes">) {
  return useAuthedQuery(api.expectations.list, { classId }, { gcTime: GC_TIME.realtime });
}
