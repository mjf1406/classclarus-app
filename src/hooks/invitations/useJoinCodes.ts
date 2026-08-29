import { useMemo } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";

import type { Id } from "../../../convex/_generated/dataModel";
import { useLogClassAccessOnce } from "@/hooks/activity/useLogClassAccess";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { api } from "../../../convex/_generated/api";
import { GC_TIME } from "@/lib/queryCache";

export function joinCodesListQueryKey(classId: Id<"classes">) {
  return convexQuery(api.joinCodes.listForClass, { classId }).queryKey;
}

export function useJoinCodes(classId: Id<"classes">) {
  const result = useAuthedQuery(
    api.joinCodes.listForClass,
    { classId },
    {
      gcTime: GC_TIME.realtime,
      placeholderData: keepPreviousData,
    },
  );
  const accessArgs = useMemo(
    () =>
      result.data !== undefined
        ? {
            classId,
            resourceType: "joinCode",
            summary: "Viewed invite codes",
            summaryKey: "activitySummary_viewedInviteCodes",
          }
        : null,
    [classId, result.data],
  );
  useLogClassAccessOnce(result.data !== undefined, accessArgs);
  return result;
}
