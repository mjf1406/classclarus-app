import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { FIVE_MINUTES } from "@/lib/queryCache";

export function seatLayoutQueryKey(classId: Id<"classes">, layoutId: Id<"seatLayouts">) {
  return convexQuery(api.seatLayouts.get, { classId, layoutId }).queryKey;
}

/** gcTime: 5 minutes — reactive via Convex; moderate cache after unmount. */
export function useSeatLayout(classId: Id<"classes">, layoutId: Id<"seatLayouts">) {
  return useAuthedQuery(api.seatLayouts.get, { classId, layoutId }, { gcTime: FIVE_MINUTES });
}
