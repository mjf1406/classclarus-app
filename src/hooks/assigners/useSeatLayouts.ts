import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { FIVE_MINUTES } from "@/lib/queryCache";

export function seatLayoutsListQueryKey(classId: Id<"classes">) {
  return convexQuery(api.seatLayouts.list, { classId }).queryKey;
}

/** gcTime: 5 minutes — reactive via Convex; moderate cache after unmount. */
export function useSeatLayouts(classId: Id<"classes"> | null) {
  return useAuthedQuery(api.seatLayouts.list, classId ? { classId } : "skip", {
    gcTime: FIVE_MINUTES,
  });
}
