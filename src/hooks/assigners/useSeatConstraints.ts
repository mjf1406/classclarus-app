import { convexQuery } from "@convex-dev/react-query";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { FIVE_MINUTES } from "@/lib/queryCache";

export function seatConstraintsListQueryKey(classId: Id<"classes">) {
  return convexQuery(api.seatConstraints.list, { classId }).queryKey;
}

/** gcTime: 5 minutes — reactive via Convex; matches seat layouts. */
export function useSeatConstraints(classId: Id<"classes">) {
  return useAuthedQuery(api.seatConstraints.list, { classId }, { gcTime: FIVE_MINUTES });
}
