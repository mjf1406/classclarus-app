import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { FIVE_MINUTES } from "@/lib/queryCache";

export function seatLayoutZoneNamesQueryKey(classId: Id<"classes">) {
  return convexQuery(api.seatLayouts.listZoneNames, { classId }).queryKey;
}

/** gcTime: 5 minutes — reactive via Convex; matches seat layouts. */
export function useSeatLayoutZoneNames(classId: Id<"classes">) {
  return useAuthedQuery(api.seatLayouts.listZoneNames, { classId }, { gcTime: FIVE_MINUTES });
}
