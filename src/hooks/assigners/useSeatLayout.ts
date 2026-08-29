import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { GC_TIME } from "@/lib/queryCache";

export function seatLayoutQueryKey(classId: Id<"classes">, layoutId: Id<"seatLayouts">) {
  return convexQuery(api.seatLayouts.get, { classId, layoutId }).queryKey;
}

/** gcTime: 5 minutes — reactive via Convex; moderate cache after unmount. */
export function useSeatLayout(classId: Id<"classes">, layoutId: Id<"seatLayouts"> | undefined) {
  return useAuthedQuery(api.seatLayouts.get, layoutId ? { classId, layoutId } : "skip", {
    gcTime: GC_TIME.realtime,
  });
}
