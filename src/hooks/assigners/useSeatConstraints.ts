import { convexQuery } from "@convex-dev/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { FIVE_MINUTES } from "@/lib/queryCache";
import type { SeatConstraintList } from "@/lib/assigners/seatConstraints";

export function seatConstraintsListQuery(classId: Id<"classes">) {
  return convexQuery(api.seatConstraints.list, { classId });
}

export function seatConstraintsListQueryKey(classId: Id<"classes">) {
  return seatConstraintsListQuery(classId).queryKey;
}

/** gcTime: 5 minutes — reactive via Convex; matches seat layouts. */
export function useSeatConstraints(classId: Id<"classes">) {
  return useAuthedQuery(api.seatConstraints.list, { classId }, { gcTime: FIVE_MINUTES });
}

/** Imperative loader for auto-assign — always refetches the authoritative constraint list. */
export function useLoadSeatConstraints() {
  const queryClient = useQueryClient();

  const load = useCallback(
    async (classId: Id<"classes">): Promise<SeatConstraintList> => {
      const query = seatConstraintsListQuery(classId);
      await queryClient.invalidateQueries({ queryKey: query.queryKey, exact: true });
      return await queryClient.fetchQuery({
        ...query,
        gcTime: FIVE_MINUTES,
      });
    },
    [queryClient],
  );

  return { load };
}
