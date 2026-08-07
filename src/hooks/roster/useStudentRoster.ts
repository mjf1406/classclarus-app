import { useMemo } from "react";
import { convexQuery } from "@convex-dev/react-query";

import type { Id } from "../../../convex/_generated/dataModel";
import { useLogClassAccessOnce } from "@/hooks/activity/useLogClassAccess";
import { useAuthedQuery } from "@/hooks/useAuthedQuery";
import { ONE_HOUR } from "@/lib/queryCache";
import { api } from "../../../convex/_generated/api";

export function studentRosterQueryKey(classId: Id<"classes">) {
  return convexQuery(api.studentRosters.list, { classId }).queryKey;
}

/** gcTime: 1 hour — reactive via Convex; matches other class member lists. */
export function useStudentRoster(classId: Id<"classes">) {
  const result = useAuthedQuery(api.studentRosters.list, { classId }, { gcTime: ONE_HOUR });
  const accessArgs = useMemo(
    () =>
      result.data !== undefined
        ? {
            classId,
            resourceType: "roster",
            resourceId: "students",
            summary: "Viewed student roster",
            summaryKey: "activitySummary_viewedMemberList",
            metadata: { role: "student" },
          }
        : null,
    [classId, result.data],
  );
  useLogClassAccessOnce(result.data !== undefined, accessArgs);
  return result;
}
