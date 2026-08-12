import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";

export type SeatLayoutMatrixDimension = "seat" | "zone" | "team" | "neighbor";

export function seatLayoutRosterMatrixQueryKey(
  classId: Id<"classes">,
  layoutId: Id<"seatLayouts">,
  dimension: SeatLayoutMatrixDimension,
) {
  return convexQuery(api.seatLayouts.rosterMatrix, { classId, layoutId, dimension }).queryKey;
}

/** gcTime: ONE_HOUR — layout seating history matrix derived from recorded placements. */
export function useSeatLayoutRosterMatrix(
  classId: Id<"classes">,
  layoutId: Id<"seatLayouts"> | undefined,
  dimension: SeatLayoutMatrixDimension,
) {
  return useAuthedQuery(
    api.seatLayouts.rosterMatrix,
    layoutId ? { classId, layoutId, dimension } : "skip",
    { gcTime: ONE_HOUR },
  );
}
