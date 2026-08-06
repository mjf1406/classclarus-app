import { keepPreviousData } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";

import type { Id } from "../../../convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { api } from "../../../convex/_generated/api";
import { ONE_HOUR } from "@/lib/queryCache";

export function joinCodesListQueryKey(classId: Id<"classes">, now: number) {
  return convexQuery(api.joinCodes.listForClass, { classId, now }).queryKey;
}

export function useJoinCodes(classId: Id<"classes">, now: number) {
  return useAuthedQuery(
    api.joinCodes.listForClass,
    { classId, now },
    {
      gcTime: ONE_HOUR,
      placeholderData: keepPreviousData,
    },
  );
}
